"""Transfer lifecycle session routes with user authorization."""

import math
from typing import Optional
from fastapi import APIRouter, Depends, Path, Query, status
from app.core.config import settings
from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.common import PaginationMeta
from app.schemas.transfers import (
    TransferListResponse,
    TransferResponse,
    TransferStatus,
)
from app.services.transfers_service import transfers_service

router = APIRouter(prefix="/transfers", tags=["Transfers"])


@router.get(
    "",
    response_model=TransferListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Transfer Sessions",
    description="Returns a paginated list of transfer sessions belonging to the authenticated user.",
)
async def list_transfers(
    page: int = Query(1, ge=1, description="Page index (1-based)"),
    limit: int = Query(
        settings.DEFAULT_PAGE_SIZE,
        ge=1,
        le=settings.MAX_PAGE_SIZE,
        description="Records per page",
    ),
    status: Optional[TransferStatus] = Query(None, description="Filter by transfer status"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> TransferListResponse:
    items, total = await transfers_service.list_transfers(
        page=page,
        limit=limit,
        status=status,
        user_id=current_user.id,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 0
    pagination = PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages)
    return TransferListResponse(items=items, pagination=pagination, is_simulated=not settings.is_supabase_configured)


@router.get(
    "/{transfer_id}",
    response_model=TransferResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Transfer Progress",
    description="Retrieves progress, chunk ratio, and recorded performance metrics for a user's transfer session.",
)
async def get_transfer(
    transfer_id: str = Path(..., description="Unique transfer session identifier (UUID v4)"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> TransferResponse:
    return await transfers_service.get_transfer(transfer_id, user_id=current_user.id)
