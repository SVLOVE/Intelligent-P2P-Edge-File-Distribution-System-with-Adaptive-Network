"""Automated tests for WebRTC signaling, tickets, sessions, and message routing."""

import json
import pytest
from starlette.websockets import WebSocketDisconnect
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.signaling import SignalingMessageType

client = TestClient(app)

USER_1_ID = "00000000-0000-0000-0000-000000000001"
USER_2_ID = "00000000-0000-0000-0000-000000000002"

AUTH_HEADERS_USER_1 = {"Authorization": f"Bearer test-token-{USER_1_ID}"}
AUTH_HEADERS_USER_2 = {"Authorization": f"Bearer test-token-{USER_2_ID}"}


def test_ice_servers_endpoint():
    """Verify ICE servers endpoint returns valid STUN/TURN configuration."""
    response = client.get("/api/v1/signaling/ice-servers")
    assert response.status_code == 200
    data = response.json()
    assert "ice_servers" in data
    assert len(data["ice_servers"]) >= 1
    assert "stun:" in data["ice_servers"][0]["urls"][0]
    assert data["is_simulated"] is False


def test_ticket_issuance_unauthorized():
    """Verify requesting a signaling ticket without authentication returns 401."""
    response = client.post("/api/v1/signaling/ticket", json={})
    assert response.status_code == 401


def test_ticket_issuance_and_single_use():
    """Verify authenticated ticket issuance and single-use consumption over WebSocket."""
    # 1. Acquire ticket
    res = client.post("/api/v1/signaling/ticket", json={}, headers=AUTH_HEADERS_USER_1)
    assert res.status_code == 201
    ticket_data = res.json()
    ticket = ticket_data["ticket"]
    assert ticket
    assert ticket_data["user_id"] == USER_1_ID

    # 2. Connect via WebSocket with ticket
    with client.websocket_connect(f"/api/v1/signaling/ws?ticket={ticket}&peer_id=peer-test-1") as ws:
        # Send ping
        ping = {"protocol_version": "v1", "type": "ping", "timestamp": 12345.0}
        ws.send_text(json.dumps(ping))
        reply = json.loads(ws.receive_text())
        assert reply["type"] == "pong"
        assert reply["timestamp"] == 12345.0

    # 3. Attempting to reuse the exact same ticket MUST fail (single-use enforcement)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/api/v1/signaling/ws?ticket={ticket}&peer_id=peer-test-reuse"):
            pass
    assert exc_info.value.code == 4001


def test_websocket_missing_auth_rejected():
    """Verify WebSocket connection with no ticket or token is rejected with 4001."""
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/v1/signaling/ws?peer_id=unauth-peer"):
            pass
    assert exc_info.value.code == 4001


def test_websocket_disallowed_origin_rejected():
    """Verify WebSocket connection with disallowed Origin is rejected with 4003."""
    res = client.post("/api/v1/signaling/ticket", json={}, headers=AUTH_HEADERS_USER_1)
    ticket = res.json()["ticket"]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"/api/v1/signaling/ws?ticket={ticket}&peer_id=peer-bad-origin",
            headers={"Origin": "https://malicious-evil-site.com"},
        ):
            pass
    assert exc_info.value.code == 4003


def test_session_creation_and_listing():
    """Verify session creation, listing, and inspection endpoints."""
    # Create session
    create_res = client.post(
        "/api/v1/signaling/sessions",
        json={"name": "Test Swarm Session", "max_peers": 8},
        headers=AUTH_HEADERS_USER_1,
    )
    assert create_res.status_code == 201
    session_data = create_res.json()
    session_id = session_data["id"]
    assert session_data["name"] == "Test Swarm Session"
    assert session_data["max_peers"] == 8
    assert session_data["created_by"] == USER_1_ID

    # List sessions
    list_res = client.get("/api/v1/signaling/sessions")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert any(s["id"] == session_id for s in list_data["items"])

    # Get single session
    get_res = client.get(f"/api/v1/signaling/sessions/{session_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == session_id


def test_signaling_session_join_and_peer_notification():
    """Verify peer discovery, session_joined event, and peer_joined broadcast between 2 peers."""
    # 1. Create a dedicated session
    s_res = client.post(
        "/api/v1/signaling/sessions",
        json={"name": "Signaling Mesh Test", "max_peers": 4},
        headers=AUTH_HEADERS_USER_1,
    )
    session_id = s_res.json()["id"]

    # 2. Issue tickets for Peer 1 and Peer 2
    t1 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_1).json()["ticket"]
    t2 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_2).json()["ticket"]

    peer1_id = "peer-alpha-1"
    peer2_id = "peer-beta-2"

    with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t1}&peer_id={peer1_id}") as ws1:
        # Peer 1 joins session
        ws1.send_text(
            json.dumps({
                "protocol_version": "v1",
                "type": SignalingMessageType.JOIN_SESSION,
                "session_id": session_id,
            })
        )
        msg1 = json.loads(ws1.receive_text())
        assert msg1["type"] == SignalingMessageType.SESSION_JOINED
        assert msg1["session_id"] == session_id
        assert msg1["existing_peers"] == []  # First peer has no predecessors

        # Now Peer 2 connects and joins same session
        with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t2}&peer_id={peer2_id}") as ws2:
            ws2.send_text(
                json.dumps({
                    "protocol_version": "v1",
                    "type": SignalingMessageType.JOIN_SESSION,
                    "session_id": session_id,
                })
            )

            # Peer 2 receives session_joined with Peer 1 in existing_peers
            msg2 = json.loads(ws2.receive_text())
            assert msg2["type"] == SignalingMessageType.SESSION_JOINED
            assert len(msg2["existing_peers"]) == 1
            assert msg2["existing_peers"][0]["peer_id"] == peer1_id

            # Peer 1 receives peer_joined notification about Peer 2
            p1_notification = json.loads(ws1.receive_text())
            assert p1_notification["type"] == SignalingMessageType.PEER_JOINED
            assert p1_notification["sender_peer_id"] == peer2_id


def test_webrtc_offer_answer_and_candidate_relay():
    """Verify direct WebRTC offer, answer, and ICE candidate exchange between authorized peers."""
    s_res = client.post(
        "/api/v1/signaling/sessions",
        json={"name": "Relay Test Session", "max_peers": 4},
        headers=AUTH_HEADERS_USER_1,
    )
    session_id = s_res.json()["id"]

    t1 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_1).json()["ticket"]
    t2 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_2).json()["ticket"]

    peer1 = "peer-caller"
    peer2 = "peer-callee"

    with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t1}&peer_id={peer1}") as ws1:
        ws1.send_text(json.dumps({"type": "join_session", "session_id": session_id}))
        ws1.receive_text()  # session_joined

        with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t2}&peer_id={peer2}") as ws2:
            ws2.send_text(json.dumps({"type": "join_session", "session_id": session_id}))
            ws2.receive_text()  # session_joined
            ws1.receive_text()  # peer_joined

            # 1. Peer 1 sends WebRTC Offer to Peer 2
            mock_offer_sdp = "v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv"
            ws1.send_text(
                json.dumps({
                    "protocol_version": "v1",
                    "type": SignalingMessageType.OFFER,
                    "session_id": session_id,
                    "target_peer_id": peer2,
                    "sdp": mock_offer_sdp,
                })
            )

            # Peer 2 receives offer with verified sender_peer_id
            received_offer = json.loads(ws2.receive_text())
            assert received_offer["type"] == SignalingMessageType.OFFER
            assert received_offer["sender_peer_id"] == peer1
            assert received_offer["sdp"] == mock_offer_sdp

            # 2. Peer 2 sends WebRTC Answer back to Peer 1
            mock_answer_sdp = "v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=recvonly"
            ws2.send_text(
                json.dumps({
                    "protocol_version": "v1",
                    "type": SignalingMessageType.ANSWER,
                    "session_id": session_id,
                    "target_peer_id": peer1,
                    "sdp": mock_answer_sdp,
                })
            )

            received_answer = json.loads(ws1.receive_text())
            assert received_answer["type"] == SignalingMessageType.ANSWER
            assert received_answer["sender_peer_id"] == peer2
            assert received_answer["sdp"] == mock_answer_sdp

            # 3. Peer 1 sends ICE candidate to Peer 2
            ice_data = {"candidate": "candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host", "sdpMid": "0"}
            ws1.send_text(
                json.dumps({
                    "protocol_version": "v1",
                    "type": SignalingMessageType.ICE_CANDIDATE,
                    "session_id": session_id,
                    "target_peer_id": peer2,
                    "candidate": ice_data,
                })
            )

            received_cand = json.loads(ws2.receive_text())
            assert received_cand["type"] == SignalingMessageType.ICE_CANDIDATE
            assert received_cand["candidate"] == ice_data
            assert received_cand["sender_peer_id"] == peer1


def test_cross_session_signaling_prohibited():
    """Verify that peers in different sessions cannot exchange messages."""
    # Create two separate sessions
    s1 = client.post(
        "/api/v1/signaling/sessions", json={"name": "Session 1"}, headers=AUTH_HEADERS_USER_1
    ).json()["id"]
    s2 = client.post(
        "/api/v1/signaling/sessions", json={"name": "Session 2"}, headers=AUTH_HEADERS_USER_2
    ).json()["id"]

    t1 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_1).json()["ticket"]
    t2 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_2).json()["ticket"]

    with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t1}&peer_id=peer-s1") as ws1:
        ws1.send_text(json.dumps({"type": "join_session", "session_id": s1}))
        ws1.receive_text()

        with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t2}&peer_id=peer-s2") as ws2:
            ws2.send_text(json.dumps({"type": "join_session", "session_id": s2}))
            ws2.receive_text()

            # Peer 1 tries to send offer to Peer 2 who is in Session 2
            ws1.send_text(
                json.dumps({
                    "type": "offer",
                    "session_id": s1,
                    "target_peer_id": "peer-s2",
                    "sdp": "mock-sdp",
                })
            )

            # Peer 1 receives an error because peer-s2 is not in session s1
            err_msg = json.loads(ws1.receive_text())
            assert err_msg["type"] == "error"
            assert "is not in session" in err_msg["message"]


def test_client_cannot_spoof_sender_peer_id():
    """Verify server enforces actual sender ID and overwrites client-supplied sender_peer_id."""
    s_res = client.post(
        "/api/v1/signaling/sessions", json={"name": "Spoof Test"}, headers=AUTH_HEADERS_USER_1
    )
    session_id = s_res.json()["id"]

    t1 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_1).json()["ticket"]
    t2 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_2).json()["ticket"]

    with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t1}&peer_id=real-peer-1") as ws1:
        ws1.send_text(json.dumps({"type": "join_session", "session_id": session_id}))
        ws1.receive_text()

        with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t2}&peer_id=real-peer-2") as ws2:
            ws2.send_text(json.dumps({"type": "join_session", "session_id": session_id}))
            ws2.receive_text()
            ws1.receive_text()

            # Real peer 1 attempts to claim it is 'fake-admin-node'
            ws1.send_text(
                json.dumps({
                    "type": "offer",
                    "session_id": session_id,
                    "sender_peer_id": "fake-admin-node",
                    "target_peer_id": "real-peer-2",
                    "sdp": "fake-sdp",
                })
            )

            received = json.loads(ws2.receive_text())
            assert received["sender_peer_id"] == "real-peer-1"  # Correctly overwritten!


def test_malformed_and_oversized_payloads():
    """Verify malformed JSON and oversized payloads are rejected safely."""
    t = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_1).json()["ticket"]
    with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t}&peer_id=err-peer") as ws:
        # 1. Malformed JSON
        ws.send_text("THIS IS NOT VALID JSON")
        reply = json.loads(ws.receive_text())
        assert reply["type"] == "error"
        assert reply["code"] == "MALFORMED_MESSAGE"

        # 2. Oversized payload (greater than 64KB)
        oversized = "x" * 70000
        ws.send_text(oversized)
        reply2 = json.loads(ws.receive_text())
        assert reply2["type"] == "error"
        assert reply2["code"] == "PAYLOAD_TOO_LARGE"


def test_peer_disconnection_cleans_up():
    """Verify that disconnecting a peer broadcasts peer_left and unregisters socket."""
    s_res = client.post(
        "/api/v1/signaling/sessions", json={"name": "Disconnect Test"}, headers=AUTH_HEADERS_USER_1
    )
    session_id = s_res.json()["id"]

    t1 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_1).json()["ticket"]
    t2 = client.post("/api/v1/signaling/ticket", headers=AUTH_HEADERS_USER_2).json()["ticket"]

    with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t1}&peer_id=watcher-peer") as ws1:
        ws1.send_text(json.dumps({"type": "join_session", "session_id": session_id}))
        ws1.receive_text()

        with client.websocket_connect(f"/api/v1/signaling/ws?ticket={t2}&peer_id=temporary-peer") as ws2:
            ws2.send_text(json.dumps({"type": "join_session", "session_id": session_id}))
            ws2.receive_text()
            ws1.receive_text()  # peer_joined

        # Temporary peer exited context (closed connection)
        left_notice = json.loads(ws1.receive_text())
        assert left_notice["type"] == SignalingMessageType.PEER_LEFT
        assert left_notice["sender_peer_id"] == "temporary-peer"
