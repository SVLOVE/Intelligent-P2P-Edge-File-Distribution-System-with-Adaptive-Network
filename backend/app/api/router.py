"""Central API v1 router consolidating all subplane route modules."""

from fastapi import APIRouter
from app.api.routes import files, health, peers, signaling, system, transfers

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(system.router)
api_router.include_router(files.router)
api_router.include_router(transfers.router)
api_router.include_router(peers.router)
api_router.include_router(signaling.router)

