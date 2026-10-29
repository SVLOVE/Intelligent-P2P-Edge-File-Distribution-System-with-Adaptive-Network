"""Schemas for transfer lifecycle sessions and progress metrics."""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import PaginationMeta, get_utc_now_iso


class TransferMode(str, Enum):
    """Network delivery modes for chunk retrieval."""

    HYBRID_P2P = "hybrid_p2p"
    ORIGIN_ONLY = "origin_only"
    P2P_ONLY = "p2p_only"


class TransferStatus(str, Enum):
    """Transfer session progression states."""

    INITIALIZING = "initializing"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class TransferResponse(BaseModel):
    """Status and metrics for a specific transfer session."""

    transfer_id: str = Field(..., description="Unique transfer session identifier (UUID v4)")
    file_id: str = Field(..., description="Associated file identifier")
    owner_id: Optional[str] = Field(None, description="UUID of authenticated owner in Supabase")
    file_name: Optional[str] = Field(None, description="Human readable file name if known")
    transfer_mode: TransferMode = Field(..., description="Active transmission strategy")
    direction: str = Field("download", description="Transfer direction (upload or download)")
    status: TransferStatus = Field(..., description="Current session state")
    chunks_total: int = Field(..., ge=0, description="Total chunks required")
    chunks_completed: int = Field(..., ge=0, description="Chunks received and verified")
    bytes_transferred: int = Field(0, ge=0, description="Total bytes transferred")
    bytes_from_p2p: int = Field(0, ge=0, description="Bytes retrieved over WebRTC data channels")
    bytes_from_origin: int = Field(0, ge=0, description="Bytes retrieved from HTTP origin fallback")
    p2p_ratio_percentage: float = Field(0.0, ge=0.0, le=100.0, description="Percentage offloaded to P2P")
    is_simulated: bool = Field(True, description="True if transfer telemetry is simulated")
    transfer_notice: str = Field(
        "Simulated transfer session. No active WebRTC data channels or live network transmissions.",
        description="Architectural boundary disclosure",
    )
    created_at: str = Field(default_factory=get_utc_now_iso, description="UTC creation timestamp")
    updated_at: str = Field(default_factory=get_utc_now_iso, description="UTC update timestamp")


class TransferListResponse(BaseModel):
    """Paginated collection of transfer sessions."""

    items: List[TransferResponse]
    pagination: PaginationMeta
    is_simulated: bool = Field(True, description="Indicates simulated development data")
