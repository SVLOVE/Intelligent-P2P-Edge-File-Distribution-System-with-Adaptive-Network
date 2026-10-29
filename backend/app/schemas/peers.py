"""Schemas for edge peer discovery and telemetry descriptors."""

from enum import Enum
from typing import List
from pydantic import BaseModel, Field
from app.schemas.common import PaginationMeta, get_utc_now_iso


class PeerRole(str, Enum):
    """Peer role in the swarm topology."""

    SEEDER = "seeder"
    LEECHER = "leecher"
    COORDINATOR = "coordinator"


class PeerStatus(str, Enum):
    """Current presence state of peer."""

    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"


class PeerResponse(BaseModel):
    """Metadata descriptor for an edge peer node."""

    peer_id: str = Field(..., description="Unique edge peer identifier")
    role: PeerRole = Field(..., description="Swarm role")
    status: PeerStatus = Field(..., description="Presence state")
    region: str = Field(..., description="Edge geographic region (e.g., us-east, eu-west)")
    device_tier: str = Field(..., description="Hardware capability tier classification")
    simulated_capacity_kbps: int = Field(
        ...,
        ge=0,
        description="Simulated upload throughput capacity (kbps) for scheduler modeling",
    )
    is_simulated: bool = Field(True, description="True if peer descriptor is simulated mock data")
    telemetry_notice: str = Field(
        "Simulated edge peer descriptor for development. Not a live physical network measurement.",
        description="Architectural boundary disclosure",
    )
    last_seen: str = Field(default_factory=get_utc_now_iso, description="UTC timestamp of last presence ping")


class PeerListResponse(BaseModel):
    """Paginated collection of discovered edge peers."""

    items: List[PeerResponse]
    pagination: PaginationMeta
    is_simulated: bool = Field(True, description="Indicates simulated development repository")
