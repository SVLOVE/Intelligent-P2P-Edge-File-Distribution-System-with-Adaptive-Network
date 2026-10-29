"""FastAPI Main Application Entrypoint."""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api import api_router
from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    starlette_http_exception_handler,
    validation_exception_handler,
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend service for Intelligent P2P Edge File Distribution System with Adaptive Network",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Exception handlers for uniform error schema
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, starlette_http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# CORS configuration - strictly bound to configured origins (no wildcard credentialed CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)

# Register consolidated API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
async def root():
    """Service root endpoint returning welcome information and links."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "health": f"{settings.API_V1_PREFIX}/health",
        "docs": "/docs",
    }
