"""System diagnostics routes."""

from fastapi import APIRouter, status
from app.schemas.system import SystemInfoResponse
from app.services.system_service import system_service

router = APIRouter(prefix="/system", tags=["System"])


@router.get(
    "/info",
    response_model=SystemInfoResponse,
    status_code=status.HTTP_200_OK,
    summary="System Diagnostics & Architecture State",
    description="Returns runtime environment, uptime, feature flags, and storage boundary disclosures.",
)
async def get_system_info() -> SystemInfoResponse:
    """Retrieve runtime system info and development disclosures."""
    return await system_service.get_system_info()
