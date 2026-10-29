"""Typed message schemas and request/response models for WebRTC signaling lifecycle."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SignalingMessageType(str, Enum):
    """Supported signaling message types."""

    JOIN_SESSION = "join_session"
    SESSION_JOINED = "session_joined"
    PEER_JOINED = "peer_joined"
    PEER_LEFT = "peer_left"
    OFFER = "offer"
    ANSWER = "answer"
    ICE_CANDIDATE = "ice_candidate"
    CONNECTION_STATE = "connection_state"
    LEAVE_SESSION = "leave_session"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"


class SignalingTicketRequest(BaseModel):
    """Request payload to acquire a short-lived single-use WebSocket ticket."""

    session_id: Optional[str] = Field(None, description="Optional target session ID to pre-authorize")


class SignalingTicketResponse(BaseModel):
    """Response containing single-use ticket for secure browser WebSocket connection."""

    ticket: str = Field(..., description="Opaque single-use cryptographic ticket")
    user_id: str = Field(..., description="Authenticated user ID")
    session_id: Optional[str] = Field(None, description="Authorized target session ID")
    expires_in: int = Field(60, description="Ticket validity window in seconds")


class IceServersResponse(BaseModel):
    """Configured STUN and TURN ICE servers for client WebRTC configuration."""

    ice_servers: List[Dict[str, Any]] = Field(..., description="List of RTCIceServer configurations")
    is_simulated: bool = Field(False, description="Indicates whether ICE endpoints are mock fixtures")
    notice: str = Field(
        "Configured STUN/TURN servers for WebRTC ICE candidate gathering and NAT traversal.",
        description="Notice regarding ICE connectivity",
    )


class SignalingSessionCreateRequest(BaseModel):
    """Request to create an authorized swarm session."""

    name: str = Field("Swarm Session", min_length=1, max_length=128, description="Human-readable session name")
    file_id: Optional[str] = Field(None, description="Optional file UUID to associate with this swarm")
    max_peers: int = Field(16, ge=2, le=64, description="Maximum concurrent peers in session")


class SignalingPeerInfo(BaseModel):
    """Metadata describing a connected peer in a session."""

    peer_id: str = Field(..., description="Unique ephemeral peer identifier")
    user_id: str = Field(..., description="Authenticated user identity UUID")
    joined_at: str = Field(..., description="UTC ISO timestamp of session join")


class SignalingSessionResponse(BaseModel):
    """Metadata descriptor for a signaling session."""

    id: str = Field(..., description="Session UUID")
    name: str = Field(..., description="Session name")
    file_id: Optional[str] = Field(None, description="Associated file UUID")
    created_by: str = Field(..., description="Creator user UUID")
    status: str = Field(..., description="Session state: active, closed, or expired")
    max_peers: int = Field(..., description="Peer capacity cap")
    active_peers_count: int = Field(0, description="Currently connected signaling peers")
    created_at: str = Field(..., description="UTC creation timestamp")


class SignalingSessionListResponse(BaseModel):
    """List of active signaling sessions."""

    items: List[SignalingSessionResponse]
    total: int


class SignalingMessageEnvelope(BaseModel):
    """Unified typed JSON envelope for WebRTC signaling messages."""

    protocol_version: str = Field("v1", description="Signaling protocol specification version")
    type: SignalingMessageType = Field(..., description="Action/event type")
    session_id: Optional[str] = Field(None, description="Target session UUID")
    sender_peer_id: Optional[str] = Field(
        None,
        description="Server-enforced sender peer ID. Client-supplied values are ignored/overwritten.",
    )
    target_peer_id: Optional[str] = Field(None, description="Target recipient peer ID for direct message routing")
    sdp: Optional[str] = Field(
        None,
        max_length=65536,
        description="Session Description Protocol (SDP) offer or answer payload",
    )
    candidate: Optional[Dict[str, Any]] = Field(
        None,
        description="ICE candidate dictionary payload",
    )
    state: Optional[str] = Field(None, description="Reported connection lifecycle state")
    existing_peers: Optional[List[SignalingPeerInfo]] = Field(
        None,
        description="List of peers present upon joining session",
    )
    code: Optional[str] = Field(None, description="Machine-readable error code")
    message: Optional[str] = Field(None, description="Human-readable informational or error description")
    timestamp: Optional[float] = Field(None, description="Epoch timestamp for ping/pong measurement")
