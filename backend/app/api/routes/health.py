"""Health check endpoint route."""

from fastapi import APIRouter, status
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Health Check",
    description="Returns service status and version information for readiness and liveness checks."
)
async def get_health() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        service="intelligent-p2p-edge-backend",
        version=settings.APP_VERSION,
    )
