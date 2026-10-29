"""Tests for backend health-check and configuration."""

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_app_imports_successfully():
    """Verify that the FastAPI application initializes successfully."""
    assert app is not None
    assert app.title == settings.APP_NAME
    assert app.version == settings.APP_VERSION


def test_health_check_endpoint():
    """Verify GET /api/v1/health returns 200 OK and expected payload."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "intelligent-p2p-edge-backend"
    assert data["version"] == settings.APP_VERSION


def test_root_endpoint():
    """Verify GET / returns welcome message and documentation links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert data["health"] == "/api/v1/health"


def test_cors_configuration():
    """Verify CORS middleware is configured with expected frontend origins."""
    expected_origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
    # Verify settings contains expected origins
    assert all(origin in settings.CORS_ORIGINS for origin in expected_origins)

    # Test preflight CORS request from allowed origin
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/api/v1/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
