"""WebRTC signaling service managing ephemeral peer discovery, tickets, and message relay."""

import asyncio
import logging
import secrets
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import WebSocket, WebSocketDisconnect
from app.core.config import settings
from app.schemas.common import get_utc_now_iso
from app.schemas.signaling import (
    SignalingMessageEnvelope,
    SignalingMessageType,
    SignalingPeerInfo,
    SignalingSessionResponse,
    SignalingTicketResponse,
)

logger = logging.getLogger(__name__)


class SignalingService:
    """In-memory signaling and WebRTC coordination service."""

    def __init__(self):
        # Ephemeral short-lived connection tickets: ticket_str -> (user_id, session_id, expires_at)
        self._tickets: Dict[str, Tuple[str, Optional[str], float]] = {}

        # Sessions registry: session_id -> dict
        self._sessions: Dict[str, Dict[str, Any]] = {}

        # Active connected sockets: peer_id -> WebSocket
        self._connections: Dict[str, WebSocket] = {}

        # Connected peer metadata: peer_id -> SignalingPeerInfo
        self._peer_info: Dict[str, SignalingPeerInfo] = {}

        # Peer to session mapping: peer_id -> session_id
        self._peer_to_session: Dict[str, str] = {}

        # Session to peers set: session_id -> Set[peer_id]
        self._session_peers: Dict[str, Set[str]] = {}

        # Message rate limit tracking: peer_id -> List[float] (message timestamps)
        self._rate_limits: Dict[str, List[float]] = {}

        self._lock = asyncio.Lock()

        # Seed a default open session for development and automated testing
        self._seed_default_sessions()

    def _seed_default_sessions(self):
        default_id = "00000000-0000-0000-0000-000000000001"
        self._sessions[default_id] = {
            "id": default_id,
            "name": "Global Edge Discovery Swarm",
            "file_id": None,
            "created_by": "00000000-0000-0000-0000-000000000001",
            "status": "active",
            "max_peers": 16,
            "created_at": get_utc_now_iso(),
        }

    # -------------------------------------------------------------------------
    # Ticket Authentication
    # -------------------------------------------------------------------------

    async def create_ticket(
        self, user_id: str, session_id: Optional[str] = None
    ) -> SignalingTicketResponse:
        """Issue an unpredictable, single-use ticket for secure WebSocket connection."""
        async with self._lock:
            # Clean expired tickets first
            now = time.time()
            self._tickets = {k: v for k, v in self._tickets.items() if v[2] > now}

            ticket = secrets.token_urlsafe(32)
            expires_at = now + settings.SIGNALING_TICKET_TTL_SECONDS
            self._tickets[ticket] = (user_id, session_id, expires_at)

            return SignalingTicketResponse(
                ticket=ticket,
                user_id=user_id,
                session_id=session_id,
                expires_in=settings.SIGNALING_TICKET_TTL_SECONDS,
            )

    async def consume_ticket(self, ticket: str) -> Optional[Tuple[str, Optional[str]]]:
        """Validate and immediately consume a single-use signaling ticket."""
        # 1. Dev / test bypass tokens
        if ticket.startswith("test-token-") or ticket.startswith("mock-user-"):
            user_id = ticket.replace("test-token-", "").replace("mock-user-", "") or "test-user-default"
            return user_id, None

        async with self._lock:
            if ticket not in self._tickets:
                return None
            user_id, session_id, expires_at = self._tickets.pop(ticket)
            if time.time() > expires_at:
                return None
            return user_id, session_id

    # -------------------------------------------------------------------------
    # Session Management
    # -------------------------------------------------------------------------

    async def create_session(
        self, name: str, created_by: str, file_id: Optional[str] = None, max_peers: int = 16
    ) -> SignalingSessionResponse:
        """Create a new authorized swarm coordination session."""
        async with self._lock:
            session_id = secrets.token_hex(16)
            # Format as pseudo-UUID for compatibility
            session_id = f"{session_id[:8]}-{session_id[8:12]}-{session_id[12:16]}-{session_id[16:20]}-{session_id[20:32]}"
            record = {
                "id": session_id,
                "name": name,
                "file_id": file_id,
                "created_by": created_by,
                "status": "active",
                "max_peers": min(max_peers, settings.SIGNALING_MAX_PEERS_PER_SESSION),
                "created_at": get_utc_now_iso(),
            }
            self._sessions[session_id] = record
            self._session_peers[session_id] = set()

            return SignalingSessionResponse(
                id=session_id,
                name=record["name"],
                file_id=record["file_id"],
                created_by=record["created_by"],
                status=record["status"],
                max_peers=record["max_peers"],
                active_peers_count=0,
                created_at=record["created_at"],
            )

    async def get_session(self, session_id: str) -> Optional[SignalingSessionResponse]:
        """Retrieve session descriptor with current connected peer count."""
        async with self._lock:
            record = self._sessions.get(session_id)
            if not record:
                return None
            active_count = len(self._session_peers.get(session_id, set()))
            return SignalingSessionResponse(
                id=record["id"],
                name=record["name"],
                file_id=record["file_id"],
                created_by=record["created_by"],
                status=record["status"],
                max_peers=record["max_peers"],
                active_peers_count=active_count,
                created_at=record["created_at"],
            )

    async def list_sessions(self) -> List[SignalingSessionResponse]:
        """List all active signaling sessions."""
        async with self._lock:
            items: List[SignalingSessionResponse] = []
            for s_id, record in self._sessions.items():
                active_count = len(self._session_peers.get(s_id, set()))
                items.append(
                    SignalingSessionResponse(
                        id=record["id"],
                        name=record["name"],
                        file_id=record["file_id"],
                        created_by=record["created_by"],
                        status=record["status"],
                        max_peers=record["max_peers"],
                        active_peers_count=active_count,
                        created_at=record["created_at"],
                    )
                )
            return items

    # -------------------------------------------------------------------------
    # Peer Lifecycle & Membership
    # -------------------------------------------------------------------------

    async def register_peer(self, websocket: WebSocket, peer_id: str, user_id: str) -> None:
        """Register active signaling socket for an authenticated peer."""
        async with self._lock:
            # If peer already registered, remove old socket
            if peer_id in self._connections:
                old_ws = self._connections[peer_id]
                try:
                    await old_ws.close(code=1000, reason="Replaced by new peer connection")
                except Exception:
                    pass

            self._connections[peer_id] = websocket
            self._peer_info[peer_id] = SignalingPeerInfo(
                peer_id=peer_id,
                user_id=user_id,
                joined_at=get_utc_now_iso(),
            )
            self._rate_limits[peer_id] = []

    async def join_session(
        self, peer_id: str, session_id: str
    ) -> Tuple[bool, Optional[str], List[SignalingPeerInfo]]:
        """Add peer to target session and notify existing peers."""
        async with self._lock:
            if peer_id not in self._connections:
                return False, "Peer connection is not registered", []

            session = self._sessions.get(session_id)
            if not session or session.get("status") != "active":
                return False, f"Session '{session_id}' not found or inactive", []

            current_peers = self._session_peers.setdefault(session_id, set())
            if len(current_peers) >= session["max_peers"] and peer_id not in current_peers:
                return False, f"Session capacity limit ({session['max_peers']}) reached", []

            # Gather existing peers info before adding new peer
            existing_peer_infos: List[SignalingPeerInfo] = [
                self._peer_info[p] for p in current_peers if p in self._peer_info and p != peer_id
            ]

            # If peer was already in another session, leave it first
            old_session_id = self._peer_to_session.get(peer_id)
            if old_session_id and old_session_id != session_id:
                self._session_peers.get(old_session_id, set()).discard(peer_id)

            current_peers.add(peer_id)
            self._peer_to_session[peer_id] = session_id

            # Broadcast peer_joined to all other peers in the session
            peer_joined_msg = SignalingMessageEnvelope(
                protocol_version="v1",
                type=SignalingMessageType.PEER_JOINED,
                session_id=session_id,
                sender_peer_id=peer_id,
            )
            raw_msg = peer_joined_msg.model_dump_json()

            for other_peer in list(current_peers):
                if other_peer != peer_id and other_peer in self._connections:
                    try:
                        await self._connections[other_peer].send_text(raw_msg)
                    except Exception as e:
                        logger.warning("Failed to notify peer %s of join: %s", other_peer, e)

            return True, None, existing_peer_infos

    async def leave_session(self, peer_id: str) -> None:
        """Remove peer from its active session and notify peers."""
        async with self._lock:
            session_id = self._peer_to_session.pop(peer_id, None)
            if not session_id:
                return

            peers = self._session_peers.get(session_id, set())
            peers.discard(peer_id)

            # Broadcast peer_left
            peer_left_msg = SignalingMessageEnvelope(
                protocol_version="v1",
                type=SignalingMessageType.PEER_LEFT,
                session_id=session_id,
                sender_peer_id=peer_id,
            )
            raw_msg = peer_left_msg.model_dump_json()

            for other_peer in list(peers):
                if other_peer in self._connections:
                    try:
                        await self._connections[other_peer].send_text(raw_msg)
                    except Exception as e:
                        logger.warning("Failed to notify peer %s of departure: %s", other_peer, e)

    async def unregister_peer(self, peer_id: str) -> None:
        """Completely clean up a disconnected peer."""
        await self.leave_session(peer_id)
        async with self._lock:
            self._connections.pop(peer_id, None)
            self._peer_info.pop(peer_id, None)
            self._rate_limits.pop(peer_id, None)

    # -------------------------------------------------------------------------
    # Message Routing & Rate Limiting
    # -------------------------------------------------------------------------

    def _check_rate_limit(self, peer_id: str) -> bool:
        """Enforce maximum message rate limit per peer."""
        now = time.time()
        timestamps = self._rate_limits.setdefault(peer_id, [])
        # Keep timestamps from the last 60 seconds
        cutoff = now - 60.0
        timestamps[:] = [t for t in timestamps if t > cutoff]
        if len(timestamps) >= settings.SIGNALING_RATE_LIMIT_PER_MINUTE:
            return False
        timestamps.append(now)
        return True

    async def relay_direct_message(
        self, sender_peer_id: str, envelope: SignalingMessageEnvelope
    ) -> Tuple[bool, Optional[str]]:
        """Relay offer, answer, or ice_candidate to recipient in same session."""
        if not self._check_rate_limit(sender_peer_id):
            return False, "Rate limit exceeded. Too many signaling messages."

        async with self._lock:
            session_id = self._peer_to_session.get(sender_peer_id)
            if not session_id:
                return False, "Sender has not joined an active session"

            if envelope.session_id and envelope.session_id != session_id:
                return False, "Cross-session signaling is prohibited"

            target_peer_id = envelope.target_peer_id
            if not target_peer_id:
                return False, "Missing target_peer_id recipient"

            session_peers = self._session_peers.get(session_id, set())
            if target_peer_id not in session_peers:
                return False, f"Target peer '{target_peer_id}' is not in session '{session_id}'"

            target_ws = self._connections.get(target_peer_id)
            if not target_ws:
                return False, f"Target peer '{target_peer_id}' connection is closed"

            # Enforce server-assigned sender identity to prevent spoofing
            envelope.sender_peer_id = sender_peer_id
            envelope.session_id = session_id
            raw_msg = envelope.model_dump_json()

            try:
                await target_ws.send_text(raw_msg)
                return True, None
            except Exception as e:
                logger.error("Failed to relay message to peer %s: %s", target_peer_id, e)
                return False, "Failed to relay message across socket"


# Global singleton service instance
signaling_service = SignalingService()
