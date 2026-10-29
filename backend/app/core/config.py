"""Application Configuration module using Pydantic Settings."""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json


class Settings(BaseSettings):
    APP_NAME: str = "Intelligent P2P Edge Backend"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    
    # Safe development default CORS origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Development & System limits
    STORAGE_ENGINE: str = "in_memory_development"
    MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024 * 1024  # 5 GiB default limit
    DEFAULT_CHUNK_SIZE_BYTES: int = 1048576  # 1 MiB standard chunk size
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Supabase Database & Auth Configuration
    SUPABASE_URL: Union[str, None] = None
    SUPABASE_ANON_KEY: Union[str, None] = None
    SUPABASE_SERVICE_ROLE_KEY: Union[str, None] = None
    SUPABASE_JWT_SECRET: Union[str, None] = None
    SUPABASE_JWT_ALGORITHM: str = "HS256"

    # WebRTC & Signaling Configuration (Phase 4.4)
    WEBRTC_STUN_URLS: str = "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
    WEBRTC_TURN_URLS: Union[str, None] = None
    WEBRTC_TURN_USERNAME: Union[str, None] = None
    WEBRTC_TURN_CREDENTIAL: Union[str, None] = None

    SIGNALING_TICKET_TTL_SECONDS: int = 60
    SIGNALING_MAX_MESSAGE_BYTES: int = 65536  # 64 KiB
    SIGNALING_MAX_PEERS_PER_SESSION: int = 16
    SIGNALING_RATE_LIMIT_PER_MINUTE: int = 120

    def get_ice_servers(self) -> List[dict]:
        """Returns structured ICE server list for WebRTC peer connections."""
        servers: List[dict] = []
        if self.WEBRTC_STUN_URLS:
            stun_urls = [u.strip() for u in self.WEBRTC_STUN_URLS.split(",") if u.strip()]
            if stun_urls:
                servers.append({"urls": stun_urls})
        if self.WEBRTC_TURN_URLS:
            turn_urls = [u.strip() for u in self.WEBRTC_TURN_URLS.split(",") if u.strip()]
            if turn_urls:
                turn_server = {"urls": turn_urls}
                if self.WEBRTC_TURN_USERNAME:
                    turn_server["username"] = self.WEBRTC_TURN_USERNAME
                if self.WEBRTC_TURN_CREDENTIAL:
                    turn_server["credential"] = self.WEBRTC_TURN_CREDENTIAL
                servers.append(turn_server)
        return servers

    @property
    def is_supabase_configured(self) -> bool:
        """Return True if required Supabase connection parameters are present."""
        return bool(self.SUPABASE_URL and (self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_ANON_KEY))

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            # Split comma-separated string
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
