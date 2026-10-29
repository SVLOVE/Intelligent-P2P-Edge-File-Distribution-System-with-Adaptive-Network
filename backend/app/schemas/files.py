"""Schemas for file catalog registration, metadata queries, and manifests."""

from enum import Enum
import math
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.common import PaginationMeta, get_utc_now_iso


class FileStatus(str, Enum):
    """File publication and cryptographic lifecycle statuses conforming to Phase 4.2/4.3 design."""

    METADATA_ONLY = "metadata_only"
    PENDING_MANIFEST = "pending_manifest"
    PENDING = "pending"
    PROCESSING = "processing"
    VERIFIED = "verified"
    AVAILABLE = "available"
    ACTIVE = "active"
    FAILED = "failed"
    DEPRECATED = "deprecated"



class FileCreateRequest(BaseModel):
    """Payload for registering a new file's metadata."""

    name: str = Field(..., min_length=1, max_length=255, description="File name with extension")
    mime_type: str = Field("application/octet-stream", max_length=100, description="MIME content type")
    total_size_bytes: int = Field(..., gt=0, description="Total byte size of the file")
    chunk_size_bytes: int = Field(1048576, gt=0, description="Size of each chunk in bytes (default: 1 MiB)")
    total_chunks: int = Field(..., gt=0, description="Total number of chunks")
    sha256_hash: Optional[str] = Field(
        None,
        pattern=r"^[a-fA-F0-9]{64}$",
        description="Optional 64-character hexadecimal SHA-256 digest of the entire file",
    )
    whole_file_sha256: Optional[str] = Field(
        None,
        pattern=r"^[a-fA-F0-9]{64}$",
        description="Optional 64-character hexadecimal whole-file digest (Phase 4.2 DB standard)",
    )
    merkle_root_hash: Optional[str] = Field(
        None,
        pattern=r"^[a-fA-F0-9]{64}$",
        description="Optional 64-character hexadecimal Merkle root hash derived from chunk leaves",
    )

    @field_validator("name")
    @classmethod
    def sanitize_file_name(cls, v: str) -> str:
        clean = v.strip()
        if ".." in clean or "/" in clean or "\\" in clean:
            raise ValueError("File name cannot contain path traversal characters (/, \\, ..).")
        return clean

    @field_validator("total_chunks")
    @classmethod
    def validate_chunk_count_consistency(cls, v: int, info) -> int:
        data = info.data
        size = data.get("total_size_bytes")
        chunk_size = data.get("chunk_size_bytes")
        if size and chunk_size:
            expected_chunks = math.ceil(size / chunk_size)
            if v != expected_chunks:
                raise ValueError(
                    f"total_chunks ({v}) does not match expected ceil(total_size_bytes / chunk_size_bytes) = {expected_chunks}."
                )
        return v

    @model_validator(mode="after")
    def unify_sha256_aliases(self) -> "FileCreateRequest":
        # Synchronize sha256_hash and whole_file_sha256
        if self.sha256_hash and not self.whole_file_sha256:
            self.whole_file_sha256 = self.sha256_hash
        elif self.whole_file_sha256 and not self.sha256_hash:
            self.sha256_hash = self.whole_file_sha256
        return self


class FileResponse(BaseModel):
    """Complete metadata for a registered file."""

    file_id: str = Field(..., description="Unique RFC 4122 UUID v4 identifier")
    owner_id: Optional[str] = Field(None, description="UUID of authenticated file owner")
    name: str = Field(..., description="File name")
    mime_type: str = Field(..., description="MIME content type")
    total_size_bytes: int = Field(..., description="Total size in bytes")
    chunk_size_bytes: int = Field(..., description="Chunk size in bytes")
    total_chunks: int = Field(..., description="Total chunk count")
    sha256_hash: Optional[str] = Field(None, description="Whole-file SHA-256 digest")
    whole_file_sha256: Optional[str] = Field(None, description="Whole-file SHA-256 digest")
    merkle_root_hash: Optional[str] = Field(None, description="Merkle root hash (H_root)")
    status: FileStatus = Field(..., description="Current publication status")
    active_seeders: int = Field(default=0, ge=0, description="Count of active seeders holding full file")
    is_simulated: bool = Field(True, description="True if operating in simulated in-memory mode")
    storage_notice: str = Field(
        "Metadata-only registration. Binary file bytes have not been uploaded.",
        description="Architectural boundary and storage disclosure",
    )
    created_at: str = Field(default_factory=get_utc_now_iso, description="UTC creation timestamp")
    updated_at: str = Field(default_factory=get_utc_now_iso, description="UTC modification timestamp")


class FileListResponse(BaseModel):
    """Paginated collection of registered files."""

    items: List[FileResponse]
    pagination: PaginationMeta
    is_simulated: bool = Field(True, description="Indicates simulated development repository")
