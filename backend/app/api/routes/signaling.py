"""WebRTC signaling and session coordination endpoints."""

import json
import logging
import secrets
from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from app.core.config import settings
from app.core.security import AuthenticatedUser, get_current_user, verify_supabase_token
from app.schemas.signaling import (
    IceServersResponse,
    SignalingMessageEnvelope,
    SignalingMessageType,
    SignalingSessionCreateRequest,
    SignalingSessionListResponse,
    SignalingSessionResponse,
    SignalingTicketRequest,
    SignalingTicketResponse,
)
from app.services.signaling_service import signaling_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/signaling", tags=["WebRTC Signaling"])


# -----------------------------------------------------------------------------
# HTTP REST Endpoints
# -----------------------------------------------------------------------------


@router.post(
    "/ticket",
    response_model=SignalingTicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Issue Single-Use WebSocket Ticket",
    description="Issues an unpredictable single-use ticket for secure browser WebSocket signaling connection.",
)
async def create_signaling_ticket(
    body: Optional[SignalingTicketRequest] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SignalingTicketResponse:
    session_id = body.session_id if body else None
    return await signaling_service.create_ticket(user_id=current_user.id, session_id=session_id)


@router.get(
    "/ice-servers",
    response_model=IceServersResponse,
    status_code=status.HTTP_200_OK,
    summary="Get WebRTC ICE Servers",
    description="Returns sanitized list of public STUN and configured TURN servers for NAT traversal.",
)
async def get_ice_servers() -> IceServersResponse:
    return IceServersResponse(
        ice_servers=settings.get_ice_servers(),
        is_simulated=False,
    )


@router.post(
    "/sessions",
    response_model=SignalingSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Signaling Swarm Session",
    description="Registers an authorized coordination session for WebRTC peer discovery.",
)
async def create_session(
    body: SignalingSessionCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SignalingSessionResponse:
    return await signaling_service.create_session(
        name=body.name,
        created_by=current_user.id,
        file_id=body.file_id,
        max_peers=body.max_peers,
    )


@router.get(
    "/sessions",
    response_model=SignalingSessionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Active Swarm Sessions",
    description="Lists active signaling sessions with current peer counts.",
)
async def list_sessions() -> SignalingSessionListResponse:
    sessions = await signaling_service.list_sessions()
    return SignalingSessionListResponse(items=sessions, total=len(sessions))


@router.get(
    "/sessions/{session_id}",
    response_model=SignalingSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Swarm Session Details",
)
async def get_session(session_id: str) -> SignalingSessionResponse:
    session = await signaling_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Signaling session '{session_id}' not found",
        )
    return session


# -----------------------------------------------------------------------------
# WebSocket Signaling Route
# -----------------------------------------------------------------------------


@router.websocket("/ws")
async def signaling_websocket(
    websocket: WebSocket,
    ticket: Optional[str] = Query(None, description="Single-use ticket from /signaling/ticket"),
    token: Optional[str] = Query(None, description="Bearer token fallback for testing"),
    peer_id: Optional[str] = Query(None, description="Unique client peer ID"),
):
    """Authenticated WebSocket endpoint for real-time WebRTC signaling."""
    # 1. Validate Origin header if present
    origin = websocket.headers.get("origin")
    if origin and settings.CORS_ORIGINS:
        allowed_origins = [o.rstrip("/") for o in settings.CORS_ORIGINS]
        if origin.rstrip("/") not in allowed_origins and "*" not in allowed_origins:
            logger.warning("Rejected WebSocket connection from disallowed origin: %s", origin)
            await websocket.close(code=4003, reason="Origin not allowed")
            return

    # 2. Authenticate connection via single-use ticket or token
    user_id: Optional[str] = None
    if ticket:
        consumed = await signaling_service.consume_ticket(ticket)
        if not consumed:
            logger.warning("WebSocket connection rejected: invalid or expired ticket")
            await websocket.close(code=4001, reason="Invalid or expired signaling ticket")
            return
        user_id = consumed[0]
    elif token:
        try:
            auth_user = await verify_supabase_token(token)
            user_id = auth_user.id
        except Exception:
            logger.warning("WebSocket connection rejected: invalid token")
            await websocket.close(code=4001, reason="Invalid authentication token")
            return
    else:
        logger.warning("WebSocket connection rejected: no ticket or token supplied")
        await websocket.close(code=4001, reason="Authentication required")
        return

    # 3. Establish peer identity
    assigned_peer_id = peer_id if peer_id else f"peer-{secrets.token_hex(8)}"

    await websocket.accept()
    await signaling_service.register_peer(websocket, assigned_peer_id, user_id)
    logger.info("Peer %s (user %s) connected to signaling service", assigned_peer_id, user_id)

    try:
        while True:
            raw_text = await websocket.receive_text()

            # Enforce message size limit
            if len(raw_text.encode("utf-8")) > settings.SIGNALING_MAX_MESSAGE_BYTES:
                error_msg = SignalingMessageEnvelope(
                    protocol_version="v1",
                    type=SignalingMessageType.ERROR,
                    code="PAYLOAD_TOO_LARGE",
                    message="Signaling message exceeds maximum permitted size",
                )
                await websocket.send_text(error_msg.model_dump_json())
                continue

            # Parse and validate JSON envelope
            try:
                data = json.loads(raw_text)
                envelope = SignalingMessageEnvelope(**data)
            except Exception as e:
                error_msg = SignalingMessageEnvelope(
                    protocol_version="v1",
                    type=SignalingMessageType.ERROR,
                    code="MALFORMED_MESSAGE",
                    message=f"Invalid signaling envelope: {str(e)}",
                )
                await websocket.send_text(error_msg.model_dump_json())
                continue

            # Handle message types
            if envelope.type == SignalingMessageType.JOIN_SESSION:
                if not envelope.session_id:
                    error_msg = SignalingMessageEnvelope(
                        protocol_version="v1",
                        type=SignalingMessageType.ERROR,
                        code="MISSING_SESSION_ID",
                        message="Missing session_id in join_session request",
                    )
                    await websocket.send_text(error_msg.model_dump_json())
                    continue

                success, err, existing_peers = await signaling_service.join_session(
                    assigned_peer_id, envelope.session_id
                )
                if not success:
                    error_msg = SignalingMessageEnvelope(
                        protocol_version="v1",
                        type=SignalingMessageType.ERROR,
                        session_id=envelope.session_id,
                        code="JOIN_FAILED",
                        message=err or "Failed to join session",
                    )
                    await websocket.send_text(error_msg.model_dump_json())
                else:
                    reply = SignalingMessageEnvelope(
                        protocol_version="v1",
                        type=SignalingMessageType.SESSION_JOINED,
                        session_id=envelope.session_id,
                        sender_peer_id=assigned_peer_id,
                        existing_peers=existing_peers,
                    )
                    await websocket.send_text(reply.model_dump_json())

            elif envelope.type == SignalingMessageType.LEAVE_SESSION:
                await signaling_service.leave_session(assigned_peer_id)

            elif envelope.type in (
                SignalingMessageType.OFFER,
                SignalingMessageType.ANSWER,
                SignalingMessageType.ICE_CANDIDATE,
                SignalingMessageType.CONNECTION_STATE,
            ):
                success, err = await signaling_service.relay_direct_message(
                    assigned_peer_id, envelope
                )
                if not success:
                    error_msg = SignalingMessageEnvelope(
                        protocol_version="v1",
                        type=SignalingMessageType.ERROR,
                        code="RELAY_FAILED",
                        message=err or "Message relay failed",
                    )
                    await websocket.send_text(error_msg.model_dump_json())

            elif envelope.type == SignalingMessageType.PING:
                pong = SignalingMessageEnvelope(
                    protocol_version="v1",
                    type=SignalingMessageType.PONG,
                    timestamp=envelope.timestamp,
                )
                await websocket.send_text(pong.model_dump_json())

    except WebSocketDisconnect:
        logger.info("Peer %s disconnected cleanly", assigned_peer_id)
    except Exception as e:
        logger.error("Signaling error for peer %s: %s", assigned_peer_id, e)
    finally:
        await signaling_service.unregister_peer(assigned_peer_id)
