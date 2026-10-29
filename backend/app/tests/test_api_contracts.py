"""Comprehensive API contract tests for Phase 4.1 & Phase 4.2 backend foundation."""

from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app

client = TestClient(app)
AUTH_HEADERS = {"Authorization": "Bearer test-token-00000000-0000-0000-0000-000000000001"}


# ==============================================================================
# 1. System & Health Endpoints
# ==============================================================================

def test_system_health_endpoint():
    """Verify GET /api/v1/health returns 200 with standard health contract without requiring Supabase."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "intelligent-p2p-edge-backend"
    assert data["version"] == settings.APP_VERSION


def test_system_info_endpoint():
    """Verify GET /api/v1/system/info returns runtime metadata and architectural disclosures."""
    response = client.get("/api/v1/system/info")
    assert response.status_code == 200
    data = response.json()

    assert data["app_name"] == settings.APP_NAME
    assert data["version"] == settings.APP_VERSION
    assert data["environment"] == settings.APP_ENV
    assert data["api_prefix"] == settings.API_V1_PREFIX
    assert "storage_engine" in data
    assert "database_readiness" in data
    assert "database_status" in data
    assert data["webrtc_signaling_status"] in ("mock_inactive", "active_in_memory_service")
    assert "uptime_seconds" in data
    assert data["uptime_seconds"] >= 0.0
    assert "server_time_utc" in data
    assert "Phase 4." in data["notice"]

    # Verify feature flags
    features = data["features"]
    assert features["p2p_chunk_distribution"] is True
    assert features["adaptive_scheduler_engine"] is True
    assert features["merkle_integrity_verification"] is True
    assert features["live_webrtc_signaling"] in (True, False)


# ==============================================================================
# 2. File Catalog Endpoints
# ==============================================================================

def test_list_files_paginated():
    """Verify GET /api/v1/files returns paginated collection with pagination metadata."""
    response = client.get("/api/v1/files?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "pagination" in data

    pagination = data["pagination"]
    assert pagination["page"] == 1
    assert pagination["limit"] == 10
    assert pagination["total"] >= 2
    assert pagination["total_pages"] >= 1

    # Check structure of items
    assert len(data["items"]) >= 2
    first = data["items"][0]
    assert "file_id" in first
    assert "name" in first
    assert "mime_type" in first
    assert "total_size_bytes" in first
    assert "total_chunks" in first
    assert "status" in first
    assert "storage_notice" in first


def test_list_files_filter_by_status():
    """Verify GET /api/v1/files?status=active filters files accurately."""
    response = client.get("/api/v1/files?status=active")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["status"] == "active"


def test_get_file_by_id_success():
    """Verify GET /api/v1/files/{file_id} returns existing file record."""
    response = client.get("/api/v1/files/f47ac10b-58cc-4372-a567-0e02b2c3d479", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()

    assert data["file_id"] == "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    assert data["name"] == "edge_model_weights.bin"
    assert data["total_size_bytes"] == 104857600
    assert data["total_chunks"] == 100
    assert data["status"] == "active"
    assert data["active_seeders"] == 4
    assert "Metadata-only registration" in data["storage_notice"]


def test_get_file_by_id_not_found():
    """Verify GET /api/v1/files/{file_id} returns 404 with structured error schema."""
    response = client.get("/api/v1/files/non-existent-uuid-9999", headers=AUTH_HEADERS)
    assert response.status_code == 404
    data = response.json()

    assert "error" in data
    err = data["error"]
    assert err["code"] == "RESOURCE_NOT_FOUND"
    assert "was not found" in err["message"]
    assert "timestamp" in err
    assert err["details"]["resource"] == "File"
    assert err["details"]["resource_id"] == "non-existent-uuid-9999"


def test_register_file_success():
    """Verify POST /api/v1/files accepts valid metadata and returns 201 Created."""
    payload = {
        "name": "climate_prediction_weights_v2.bin",
        "mime_type": "application/octet-stream",
        "total_size_bytes": 52428800,  # 50 MB
        "chunk_size_bytes": 1048576,  # 1 MB
        "total_chunks": 50,
        "sha256_hash": "a" * 64,
        "merkle_root_hash": "b" * 64,
    }
    response = client.post("/api/v1/files", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 201
    data = response.json()

    assert "file_id" in data
    assert data["name"] == payload["name"]
    assert data["status"] in ("metadata_only", "pending_manifest")
    assert data["total_size_bytes"] == 52428800
    assert data["total_chunks"] == 50
    assert data["sha256_hash"] == payload["sha256_hash"]
    assert data["merkle_root_hash"] == payload["merkle_root_hash"]
    assert data["owner_id"] == "00000000-0000-0000-0000-000000000001"
    assert "Metadata-only registration" in data["storage_notice"]

    # Verify newly created file can be retrieved via GET
    get_res = client.get(f"/api/v1/files/{data['file_id']}", headers=AUTH_HEADERS)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == payload["name"]


def test_register_file_duplicate_hash_conflict():
    """Verify POST /api/v1/files with duplicate hash returns 409 Conflict with structured error."""
    # Use existing seeded hash
    payload = {
        "name": "duplicate_model.bin",
        "mime_type": "application/octet-stream",
        "total_size_bytes": 104857600,
        "chunk_size_bytes": 1048576,
        "total_chunks": 100,
        "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    }
    response = client.post("/api/v1/files", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 409
    data = response.json()

    assert "error" in data
    err = data["error"]
    assert err["code"] == "FILE_HASH_ALREADY_REGISTERED"
    assert "already registered" in err["message"]
    assert "timestamp" in err


def test_register_file_validation_errors():
    """Verify POST /api/v1/files with invalid payload returns 422 Unprocessable Entity."""
    # Case 1: Bad sha256 format (not 64 hex chars)
    bad_hash_payload = {
        "name": "invalid_hash.bin",
        "total_size_bytes": 1048576,
        "chunk_size_bytes": 1048576,
        "total_chunks": 1,
        "sha256_hash": "invalid-non-hex-hash",
    }
    res1 = client.post("/api/v1/files", json=bad_hash_payload, headers=AUTH_HEADERS)
    assert res1.status_code == 422
    err1 = res1.json()["error"]
    assert err1["code"] == "VALIDATION_ERROR"
    assert "validation_errors" in err1["details"]

    # Case 2: Negative or zero size
    zero_size_payload = {
        "name": "zero_size.bin",
        "total_size_bytes": 0,
        "chunk_size_bytes": 1048576,
        "total_chunks": 1,
        "sha256_hash": "a" * 64,
    }
    res2 = client.post("/api/v1/files", json=zero_size_payload, headers=AUTH_HEADERS)
    assert res2.status_code == 422

    # Case 3: Path traversal attempt in name
    traversal_payload = {
        "name": "../../etc/shadow",
        "total_size_bytes": 1048576,
        "chunk_size_bytes": 1048576,
        "total_chunks": 1,
        "sha256_hash": "b" * 64,
    }
    res3 = client.post("/api/v1/files", json=traversal_payload, headers=AUTH_HEADERS)
    assert res3.status_code == 422


# ==============================================================================
# 3. Transfer Lifecycle Endpoints
# ==============================================================================

def test_list_transfers_paginated():
    """Verify GET /api/v1/transfers returns paginated transfer sessions for authenticated user."""
    response = client.get("/api/v1/transfers?page=1&limit=10", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "pagination" in data
    assert len(data["items"]) >= 2

    first = data["items"][0]
    assert "transfer_id" in first
    assert "file_id" in first
    assert "transfer_mode" in first
    assert "status" in first
    assert "chunks_total" in first
    assert "chunks_completed" in first
    assert "transfer_notice" in first


def test_get_transfer_by_id_success():
    """Verify GET /api/v1/transfers/{transfer_id} returns active transfer session for its owner."""
    response = client.get(
        "/api/v1/transfers/t982b10a-319a-4c90-b9df-415891ac3710",
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["transfer_id"] == "t982b10a-319a-4c90-b9df-415891ac3710"
    assert data["status"] == "active"
    assert data["chunks_total"] == 100
    assert data["chunks_completed"] == 45
    assert data["p2p_ratio_percentage"] == 77.7
    assert "Simulated transfer session" in data["transfer_notice"]


def test_get_transfer_not_found():
    """Verify GET /api/v1/transfers/{transfer_id} for non-existent session returns 404."""
    response = client.get("/api/v1/transfers/non-existent-transfer-id", headers=AUTH_HEADERS)
    assert response.status_code == 404
    data = response.json()

    assert "error" in data
    err = data["error"]
    assert err["code"] == "RESOURCE_NOT_FOUND"
    assert "was not found" in err["message"]
    assert err["details"]["resource"] == "Transfer"


# ==============================================================================
# 4. Peer Discovery Endpoints
# ==============================================================================

def test_list_peers_paginated():
    """Verify GET /api/v1/peers returns paginated edge peer descriptors."""
    response = client.get("/api/v1/peers?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "pagination" in data
    assert data["is_simulated"] is True
    assert len(data["items"]) >= 4

    first = data["items"][0]
    assert "peer_id" in first
    assert "role" in first
    assert "status" in first
    assert "region" in first
    assert "device_tier" in first
    assert "simulated_capacity_kbps" in first
    assert first["is_simulated"] is True
    assert "Simulated edge peer descriptor" in first["telemetry_notice"]


def test_list_peers_filter_by_role():
    """Verify GET /api/v1/peers?role=seeder returns only seeders."""
    response = client.get("/api/v1/peers?role=seeder")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 2
    for peer in data["items"]:
        assert peer["role"] == "seeder"


# ==============================================================================
# 5. Security & CORS Configuration
# ==============================================================================

def test_cors_preflight_on_all_subplanes():
    """Verify CORS preflight succeeds with allowed origin on system, files, transfers, and peers."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    for path in ["/api/v1/system/info", "/api/v1/files", "/api/v1/transfers", "/api/v1/peers"]:
        res = client.options(path, headers=headers)
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
