"""Core custom exceptions and standardized error response handlers."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def get_utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format with Z suffix."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class AppException(Exception):
    """Base application exception for structured errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ResourceNotFoundError(AppException):
    """Raised when a requested resource is not found."""

    def __init__(
        self,
        resource: str,
        resource_id: str,
        code: str = "RESOURCE_NOT_FOUND",
        details: Optional[Dict[str, Any]] = None,
    ):
        message = f"{resource} with identifier '{resource_id}' was not found."
        super().__init__(
            message=message,
            code=code,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details or {"resource": resource, "resource_id": resource_id},
        )


class ResourceConflictError(AppException):
    """Raised when a resource creation conflicts with existing data."""

    def __init__(
        self,
        message: str,
        code: str = "RESOURCE_CONFLICT",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code=code,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class BadRequestError(AppException):
    """Raised when request payload or parameters are invalid."""

    def __init__(
        self,
        message: str,
        code: str = "BAD_REQUEST",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code=code,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class UnauthorizedError(AppException):
    """Raised when authentication credentials are missing or invalid."""

    def __init__(
        self,
        message: str = "Authentication required.",
        code: str = "UNAUTHORIZED",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code=code,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class ForbiddenError(AppException):
    """Raised when user does not have permission to access or modify resource."""

    def __init__(
        self,
        message: str = "You do not have permission to access or modify this resource.",
        code: str = "FORBIDDEN",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code=code,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )



async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Format custom AppException instances into standard error schema."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "timestamp": get_utc_now_iso(),
            }
        },
    )


async def starlette_http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Format standard HTTP exceptions into standard error schema."""
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        429: "RATE_LIMITED",
        500: "INTERNAL_SERVER_ERROR",
    }
    code = code_map.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": str(exc.detail),
                "details": {},
                "timestamp": get_utc_now_iso(),
            }
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Format Pydantic RequestValidationErrors into standard error schema."""
    errors_summary = []
    for err in exc.errors():
        loc = " -> ".join(str(item) for item in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        errors_summary.append({"location": loc, "issue": msg, "type": err.get("type")})

    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The request payload failed schema validation.",
                "details": {"validation_errors": errors_summary},
                "timestamp": get_utc_now_iso(),
            }
        },
    )
