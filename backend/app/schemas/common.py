"""Common schemas used across multiple API endpoints."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


def get_utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 string format with Z suffix."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class ErrorDetail(BaseModel):
    """Detailed error object conforming to API_CONTRACTS.md specification."""

    code: str = Field(..., description="Machine-readable uppercase error string")
    message: str = Field(..., description="Human-readable error explanation")
    details: Dict[str, Any] = Field(default_factory=dict, description="Contextual error metadata")
    timestamp: str = Field(default_factory=get_utc_now_iso, description="UTC timestamp of occurrence")


class ErrorResponse(BaseModel):
    """Top-level error response payload."""

    error: ErrorDetail


class PaginationMeta(BaseModel):
    """Metadata describing collection pagination state."""

    page: int = Field(..., ge=1, description="Current page number (1-indexed)")
    limit: int = Field(..., ge=1, le=100, description="Items requested per page")
    total: int = Field(..., ge=0, description="Total matching items available")
    total_pages: int = Field(..., ge=0, description="Total pages available at current limit")


class HealthCheckResponse(BaseModel):
    """Health check response schema (matches Phase 1 contract exactly)."""

    status: str = Field("ok", description="Current service health state")
    service: str = Field("intelligent-p2p-edge-backend", description="Microservice name")
    version: str = Field(..., description="Semantic service version")
