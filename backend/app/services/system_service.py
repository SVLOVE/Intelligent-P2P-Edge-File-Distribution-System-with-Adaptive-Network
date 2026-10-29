"""System diagnostics and runtime metadata service."""

import time
from app.core.config import settings
from app.core.supabase import supabase_client
from app.schemas.common import get_utc_now_iso
from app.schemas.system import SystemInfoResponse

START_TIME = time.time()


class SystemService:
    """Provides system diagnostics and runtime state."""

    def __init__(self, start_time: float = START_TIME):
        self._start_time = start_time

    async def get_system_info(self) -> SystemInfoResponse:
        uptime = round(time.time() - self._start_time, 2)
        
        # Determine database readiness and storage engine
        if settings.is_supabase_configured:
            is_healthy = await supabase_client.check_health()
            if is_healthy:
                db_readiness = "connected"
                db_status = "ready"
                storage_engine = "supabase_postgresql"
            else:
                db_readiness = "disconnected"
                db_status = "degraded"
                storage_engine = "in_memory_fallback"
        else:
            db_readiness = "unconfigured_in_memory_fallback"
            db_status = "ready"
            storage_engine = settings.STORAGE_ENGINE

        features = {
            "p2p_chunk_distribution": True,
            "adaptive_scheduler_engine": True,
            "merkle_integrity_verification": True,
            "supabase_cloud_persistence": settings.is_supabase_configured,
            "live_webrtc_signaling": True,
            "local_storage_caching": True,
        }

        return SystemInfoResponse(
            app_name=settings.APP_NAME,
            version=settings.APP_VERSION,
            environment=settings.APP_ENV,
            api_prefix=settings.API_V1_PREFIX,
            uptime_seconds=uptime,
            storage_engine=storage_engine,
            database_readiness=db_readiness,
            database_status=db_status,
            webrtc_signaling_status="active_in_memory_service",
            features=features,
            server_time_utc=get_utc_now_iso(),
            is_development_simulation=not settings.is_supabase_configured,
            notice=(
                "Phase 4.4 backend with Supabase persistence and authenticated WebRTC WebSocket signaling. Data channel control testing active (binary chunk transfer remains Phase 4.5)."
            ),
        )


system_service = SystemService()
