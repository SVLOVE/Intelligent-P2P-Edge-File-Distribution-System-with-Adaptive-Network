"""Peer discovery and edge node telemetry routes."""

import math
from typing import Optional
from fastapi import APIRouter, Query, status
from app.core.config import settings
from app.schemas.common import PaginationMeta
from app.schemas.peers import PeerListResponse, PeerRole
from app.services.peers_service import peers_service

router = APIRouter(prefix="/peers", tags=["Peers"])


@router.get(
    "",
    response_model=PeerListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Discovered Edge Peers",
    description="Returns a paginated list of active candidate edge peers and their simulated capacity descriptors.",
)
async def list_peers(
    page: int = Query(1, ge=1, description="Page index (1-based)"),
    limit: int = Query(
        settings.DEFAULT_PAGE_SIZE,
        ge=1,
        le=settings.MAX_PAGE_SIZE,
        description="Records per page",
    ),
    role: Optional[PeerRole] = Query(None, description="Filter peers by network role"),
) -> PeerListResponse:
    items, total = peers_service.list_peers(page=page, limit=limit, role=role)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    pagination = PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages)
    return PeerListResponse(items=items, pagination=pagination, is_simulated=True)
