"""System and diagnostic schema definitions."""

from typing import Dict
from pydantic import BaseModel, Field
from app.schemas.common import get_utc_now_iso


class SystemInfoResponse(BaseModel):
    """Runtime diagnostics and architectural feature state."""

    app_name: str = Field(..., description="Application name")
    version: str = Field(..., description="Application release version")
    environment: str = Field(..., description="Deployment environment (development/production)")
    api_prefix: str = Field(..., description="Base API route prefix")
    uptime_seconds: float = Field(..., ge=0.0, description="Process uptime in seconds")
    storage_engine: str = Field("in_memory_development", description="Active storage backend identifier")
    database_readiness: str = Field("unconfigured_in_memory_fallback", description="Supabase database readiness status")
    database_status: str = Field("ready", description="Operational state of metadata store")
    webrtc_signaling_status: str = Field("mock_inactive", description="State of WebRTC signaling subplane")
    features: Dict[str, bool] = Field(..., description="Active capability toggles")
    server_time_utc: str = Field(default_factory=get_utc_now_iso, description="Server system clock in UTC")
    is_development_simulation: bool = Field(True, description="Indicates whether this environment runs in dev simulation")
    notice: str = Field(
        "Phase 4.2 backend with Supabase database integration. Live WebRTC peer channels remain disabled.",
        description="Architectural boundary disclosure",
    )
