"""Pydantic schemas for file chunk manifests, Merkle proofs, and integrity verification."""

from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import PaginationMeta


class ChunkMetadataSchema(BaseModel):
    """Authoritative metadata descriptor for an individual 1 MiB chunk."""

    chunk_index: int = Field(..., ge=0, description="Zero-based sequence index")
    byte_offset: int = Field(..., ge=0, description="Starting byte offset in original file")
    byte_length: int = Field(..., gt=0, description="Byte length of this specific chunk")
    sha256_hash: str = Field(
        ...,
        pattern=r"^[a-fA-F0-9]{64}$",
        description="64-character lowercase hexadecimal SHA-256 digest of chunk bytes",
    )
    merkle_leaf_hash: Optional[str] = Field(
        None,
        pattern=r"^[a-fA-F0-9]{64}$",
        description="Domain-separated Merkle leaf hash SHA256(0x00 || chunk_bytes)",
    )


class ChunkProofElementSchema(BaseModel):
    """Single step element in a Merkle inclusion audit path."""

    position: str = Field(..., pattern=r"^(left|right)$", description="Relative sibling position")
    hash: str = Field(..., pattern=r"^[a-fA-F0-9]{64}$", description="64-character lowercase hex sibling hash")


class ChunkProofResponse(BaseModel):
    """Inclusion proof audit path proving chunk membership in the file's Merkle tree."""

    file_id: str = Field(..., description="UUID v4 of parent file")
    chunk_index: int = Field(..., ge=0, description="Chunk sequence index")
    chunk_sha256: str = Field(..., description="Ordinary SHA-256 digest of chunk")
    merkle_leaf_hash: str = Field(..., description="Domain-separated Merkle leaf hash")
    merkle_root: str = Field(..., description="Authoritative Merkle root hash (H_root)")
    proof: List[ChunkProofElementSchema] = Field(..., description="Sequence of sibling proofs to root")


class ChunkVerifyRequest(BaseModel):
    """Payload for verifying a received chunk against an expected Merkle root."""

    chunk_index: int = Field(..., ge=0, description="Chunk sequence index")
    chunk_data_base64: Optional[str] = Field(None, description="Base64-encoded chunk binary payload")
    chunk_sha256: Optional[str] = Field(None, pattern=r"^[a-fA-F0-9]{64}$", description="Chunk SHA-256 digest")
    merkle_leaf_hash: Optional[str] = Field(None, pattern=r"^[a-fA-F0-9]{64}$", description="Merkle leaf hash")
    proof: List[ChunkProofElementSchema] = Field(..., description="Merkle inclusion proof audit path")
    expected_merkle_root: str = Field(
        ...,
        pattern=r"^[a-fA-F0-9]{64}$",
        description="Trusted expected Merkle root from authoritative manifest",
    )


class ChunkVerifyResponse(BaseModel):
    """Result of Merkle inclusion proof verification."""

    file_id: str = Field(..., description="UUID v4 of parent file")
    chunk_index: int = Field(..., ge=0, description="Chunk index verified")
    verified: bool = Field(..., description="True if computed root matches expected root byte-for-byte")
    reason: Optional[str] = Field(None, description="Explanation if verification failed")
    computed_root: str = Field(..., description="Calculated Merkle root hash")
    expected_root: str = Field(..., description="Expected Merkle root hash")


class ChunkManifestUploadRequest(BaseModel):
    """Payload for registering a complete chunk manifest for a pending file."""

    chunks: List[ChunkMetadataSchema] = Field(..., min_length=1, description="Ordered chunk descriptors")


class ChunkManifestListResponse(BaseModel):
    """Paginated collection of chunk descriptors for a file."""

    file_id: str = Field(..., description="UUID v4 of file")
    items: List[ChunkMetadataSchema] = Field(..., description="List of chunk descriptors")
    pagination: PaginationMeta = Field(..., description="Pagination metadata")
    is_simulated: bool = Field(False, description="True if manifest data is simulated")


class FileIntegrityManifestResponse(BaseModel):
    """Complete cryptographic integrity manifest for a file."""

    file_id: str = Field(..., description="UUID v4 of file")
    name: str = Field(..., description="File name")
    status: str = Field(..., description="Integrity status (pending, processing, verified, failed)")
    total_size_bytes: int = Field(..., ge=0, description="Total size in bytes")
    chunk_size_bytes: int = Field(..., gt=0, description="Chunk size in bytes")
    total_chunks: int = Field(..., ge=0, description="Total chunk count")
    whole_file_sha256: str = Field(..., description="Authoritative whole-file SHA-256 digest")
    merkle_root_hash: str = Field(..., description="Authoritative Merkle root hash (H_root)")
    algorithm: str = Field("SHA-256", description="Digest algorithm")
    merkle_encoding: str = Field(
        "v1-domain-separated-rfc6962-style",
        description="Merkle tree leaf/node domain separation encoding standard",
    )
    chunks: List[ChunkMetadataSchema] = Field(..., description="Array of chunk metadata")
    is_simulated: bool = Field(False, description="True if manifest is simulated mock data")
