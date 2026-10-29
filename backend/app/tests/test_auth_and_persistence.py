"""Unit and contract tests verifying Phase 4.2 Supabase authentication, authorization, and persistence."""

from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app

client = TestClient(app)

USER_A_AUTH = {"Authorization": "Bearer test-token-usr-alice-1111"}
USER_B_AUTH = {"Authorization": "Bearer test-token-usr-bob-2222"}


def test_health_endpoint_independent_of_supabase():
    """Requirement 1: Health endpoint works without Supabase or database connectivity."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == settings.APP_VERSION


def test_missing_database_configuration_handled_safely():
    """Requirement 2: Missing database configuration results in safe in-memory fallback without crashes."""
    response = client.get("/api/v1/system/info")
    assert response.status_code == 200
    data = response.json()
    assert "database_readiness" in data
    # When SUPABASE_URL is unconfigured, should report fallback
    if not settings.is_supabase_configured:
        assert data["database_readiness"] == "unconfigured_in_memory_fallback"
        assert data["storage_engine"] == "in_memory_development"


def test_unauthenticated_protected_file_post_returns_401():
    """Requirement 4: Unauthenticated POST to /api/v1/files returns 401 Unauthorized."""
    payload = {
        "name": "unauthenticated_upload.bin",
        "mime_type": "application/octet-stream",
        "total_size_bytes": 1048576,
        "chunk_size_bytes": 1048576,
        "total_chunks": 1,
        "sha256_hash": "c" * 64,
    }
    # No Authorization header
    response = client.post("/api/v1/files", json=payload)
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "UNAUTHORIZED"


def test_invalid_bearer_token_format_returns_401():
    """Requirement 5: Malformed Authorization header returns 401 Unauthorized."""
    payload = {
        "name": "bad_token.bin",
        "total_size_bytes": 1048576,
        "chunk_size_bytes": 1048576,
        "total_chunks": 1,
        "sha256_hash": "d" * 64,
    }
    # Bad header without 'Bearer' prefix
    response = client.post("/api/v1/files", json=payload, headers={"Authorization": "Basic 123456"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_unauthenticated_transfers_list_returns_401():
    """Requirement 4b: GET /api/v1/transfers without token returns 401."""
    response = client.get("/api/v1/transfers")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_authenticated_user_accesses_own_metadata_and_persistence():
    """Requirements 6 & 9: Authenticated user registers file; derives owner_id from token; persists file."""
    payload = {
        "name": "alice_private_weights.bin",
        "mime_type": "application/octet-stream",
        "total_size_bytes": 2097152,  # 2 MB
        "chunk_size_bytes": 1048576,  # 1 MB
        "total_chunks": 2,
        "sha256_hash": "e" * 64,
        "merkle_root_hash": "f" * 64,
    }
    # Alice creates a file
    res = client.post("/api/v1/files", json=payload, headers=USER_A_AUTH)
    assert res.status_code == 201
    file_data = res.json()
    file_id = file_data["file_id"]

    assert file_data["owner_id"] == "usr-alice-1111"
    assert file_data["status"] == "metadata_only"
    assert file_data["name"] == payload["name"]

    # Alice can retrieve it
    alice_get = client.get(f"/api/v1/files/{file_id}", headers=USER_A_AUTH)
    assert alice_get.status_code == 200
    assert alice_get.json()["file_id"] == file_id
    assert alice_get.json()["owner_id"] == "usr-alice-1111"


def test_cross_user_access_denial_for_private_file():
    """Requirement 7: User B cannot access User A's private file (returns 404 to avoid leaking existence)."""
    payload = {
        "name": "alice_confidential_document.pdf",
        "mime_type": "application/pdf",
        "total_size_bytes": 1048576,
        "chunk_size_bytes": 1048576,
        "total_chunks": 1,
        "sha256_hash": "1" * 64,
    }
    res = client.post("/api/v1/files", json=payload, headers=USER_A_AUTH)
    assert res.status_code == 201
    file_id = res.json()["file_id"]

    # User B (Bob) attempts to access Alice's private metadata
    bob_get = client.get(f"/api/v1/files/{file_id}", headers=USER_B_AUTH)
    assert bob_get.status_code == 404
    err = bob_get.json()["error"]
    assert err["code"] == "RESOURCE_NOT_FOUND"
    assert file_id in err["message"]


def test_cross_user_access_denial_for_transfers():
    """Requirement 7b: User B cannot access User A's transfer session."""
    # Seeded transfer t982b10a belongs to user '00000000-0000-0000-0000-000000000001'
    # Bob (usr-bob-2222) attempts to fetch it
    res = client.get("/api/v1/transfers/t982b10a-319a-4c90-b9df-415891ac3710", headers=USER_B_AUTH)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_invalid_file_metadata_rejected_with_422():
    """Requirement 8: Invalid file metadata fails with 422 and structured error details."""
    payload = {
        "name": "bad_chunks.bin",
        "total_size_bytes": 5242880,  # 5 MB
        "chunk_size_bytes": 1048576,  # 1 MB
        "total_chunks": 99,  # Inconsistent chunk count (should be 5)
        "sha256_hash": "2" * 64,
    }
    res = client.post("/api/v1/files", json=payload, headers=USER_A_AUTH)
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert "validation_errors" in err["details"]


def test_missing_file_and_transfer_returns_404():
    """Requirement 10: Non-existent file and transfer IDs return 404 with structured error."""
    res_f = client.get("/api/v1/files/00000000-0000-0000-0000-000000000000", headers=USER_A_AUTH)
    assert res_f.status_code == 404
    assert res_f.json()["error"]["code"] == "RESOURCE_NOT_FOUND"

    res_t = client.get("/api/v1/transfers/00000000-0000-0000-0000-000000000000", headers=USER_A_AUTH)
    assert res_t.status_code == 404
    assert res_t.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_error_responses_contain_no_credentials_or_internal_leaks():
    """Requirement 12: Error responses conform to error contract and omit stack traces or secrets."""
    res = client.get("/api/v1/files/invalid-id", headers=USER_A_AUTH)
    data = res.json()
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "timestamp" in data["error"]
    raw_text = res.text.lower()
    assert "password" not in raw_text
    assert "service_role" not in raw_text
    assert "secret" not in raw_text
    assert "traceback" not in raw_text


def test_live_supabase_connectivity():
    """Live integration check: verifies remote Supabase PostgreSQL endpoint when .env configured."""
    from dotenv import dotenv_values
    import httpx

    vals = dotenv_values(".env")
    url = vals.get("SUPABASE_URL")
    anon_key = vals.get("SUPABASE_ANON_KEY")

    if not url or not anon_key:
        # Gracefully skip if credentials are not configured in local environment
        return

    key = vals.get("SUPABASE_SERVICE_ROLE_KEY") or anon_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    # Verify live remote Supabase PostgREST endpoint
    res = httpx.get(f"{url.rstrip('/')}/rest/v1/", headers=headers, timeout=5.0)
    assert res.status_code == 200
    assert "swagger" in res.json()
