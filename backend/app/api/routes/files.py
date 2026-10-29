import math
from typing import Optional
from fastapi import APIRouter, Depends, Header, Path, Query, Request, status
from app.core.config import settings

from app.core.exceptions import BadRequestError
from app.core.security import AuthenticatedUser, get_current_user, get_optional_user
from app.schemas.common import PaginationMeta
from app.schemas.files import (
    FileCreateRequest,
    FileListResponse,
    FileResponse,
    FileStatus,
)
from app.schemas.integrity import (
    ChunkManifestListResponse,
    ChunkManifestUploadRequest,
    ChunkProofResponse,
    ChunkVerifyRequest,
    ChunkVerifyResponse,
    FileIntegrityManifestResponse,
)
from app.services.files_service import files_service

router = APIRouter(prefix="/files", tags=["Files"])


@router.get(
    "",
    response_model=FileListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Registered Files",
    description="Returns a paginated collection of registered file metadata descriptors.",
)
async def list_files(
    page: int = Query(1, ge=1, description="Page index (1-based)"),
    limit: int = Query(
        settings.DEFAULT_PAGE_SIZE,
        ge=1,
        le=settings.MAX_PAGE_SIZE,
        description="Records per page",
    ),
    status: Optional[FileStatus] = Query(None, description="Filter by file publication state"),
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
) -> FileListResponse:
    user_id = current_user.id if current_user else None
    items, total = await files_service.list_files(page=page, limit=limit, status=status, user_id=user_id)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    pagination = PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages)
    return FileListResponse(items=items, pagination=pagination, is_simulated=not settings.is_supabase_configured)


@router.post(
    "",
    response_model=FileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register File Metadata",
    description="Registers new file publication metadata bound to the authenticated owner's identity.",
)
async def register_file(
    request: FileCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> FileResponse:
    return await files_service.create_file(request, owner_id=current_user.id)


@router.post(

    "/process",
    response_model=FileIntegrityManifestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process Binary File Stream",
    description="Streams real file binary, splits into 1 MiB chunks, calculates genuine SHA-256 digests and Merkle tree, and persists verified metadata.",
)
async def process_binary_file(
    request: Request,
    filename: str = Query(..., description="File name with extension"),
    content_type: Optional[str] = Header(None, description="MIME content type"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> FileIntegrityManifestResponse:
    if not filename:
        raise BadRequestError("Uploaded file must have a valid filename.")

    clean_filename = filename.strip()
    if ".." in clean_filename or "/" in clean_filename or "\\" in clean_filename:
        raise BadRequestError("Invalid filename: path traversal characters are forbidden.")

    mime = content_type or "application/octet-stream"
    body_stream = await request.body()
    import io
    return await files_service.process_file_binary(
        filename=clean_filename,
        mime_type=mime,
        stream=io.BytesIO(body_stream),
        owner_id=current_user.id,
    )



@router.get(
    "/{file_id}",
    response_model=FileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get File Metadata",
    description="Retrieves complete metadata and swarm status for a specific file by its UUID v4.",
)
async def get_file(
    file_id: str = Path(..., description="Unique RFC 4122 UUID v4 of the target file"),
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
) -> FileResponse:
    user_id = current_user.id if current_user else None
    return await files_service.get_file(file_id, user_id=user_id)


@router.post(
    "/{file_id}/chunks",
    status_code=status.HTTP_201_CREATED,
    summary="Register Chunk Manifest",
    description="Registers an ordered chunk manifest for an existing file record.",
)
async def register_chunks(
    file_id: str = Path(..., description="File UUID v4"),
    payload: ChunkManifestUploadRequest = ...,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    count = await files_service.register_chunks(file_id, payload.chunks, user_id=current_user.id)
    return {"file_id": file_id, "registered_chunks": count, "status": "stored"}


@router.get(
    "/{file_id}/chunks",
    response_model=ChunkManifestListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Chunk Metadata Descriptors",
    description="Returns a paginated list of chunk descriptors (offsets, lengths, and hashes) for a file.",
)
async def list_chunks(
    file_id: str = Path(..., description="File UUID v4"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(50, ge=1, le=1000, description="Chunk descriptors per page"),
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
) -> ChunkManifestListResponse:
    user_id = current_user.id if current_user else None
    items, total, is_simulated = await files_service.list_chunks(
        file_id=file_id,
        page=page,
        limit=limit,
        user_id=user_id,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 0
    pagination = PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages)
    return ChunkManifestListResponse(
        file_id=file_id,
        items=items,
        pagination=pagination,
        is_simulated=is_simulated,
    )


@router.get(
    "/{file_id}/chunks/{chunk_index}/proof",
    response_model=ChunkProofResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Merkle Inclusion Proof",
    description="Retrieves the cryptographic Merkle audit path proving chunk membership in the file's Merkle tree.",
)
async def get_chunk_proof(
    file_id: str = Path(..., description="File UUID v4"),
    chunk_index: int = Path(..., ge=0, description="Chunk sequence index"),
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
) -> ChunkProofResponse:
    user_id = current_user.id if current_user else None
    return await files_service.get_chunk_proof(
        file_id=file_id,
        chunk_index=chunk_index,
        user_id=user_id,
    )


@router.post(
    "/{file_id}/integrity/verify",
    response_model=ChunkVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Chunk Inclusion Proof",
    description="Verifies a chunk and its Merkle inclusion proof against the file's authoritative Merkle root.",
)
async def verify_chunk(
    file_id: str = Path(..., description="File UUID v4"),
    request: ChunkVerifyRequest = ...,
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
) -> ChunkVerifyResponse:
    user_id = current_user.id if current_user else None
    return await files_service.verify_chunk(
        file_id=file_id,
        request=request,
        user_id=user_id,
    )


@router.get(
    "/{file_id}/integrity",
    response_model=FileIntegrityManifestResponse,
    status_code=status.HTTP_200_OK,
    summary="Get File Integrity Manifest",
    description="Retrieves the complete cryptographic integrity manifest with whole-file SHA-256, Merkle root, and all chunk descriptors.",
)
async def get_file_integrity(
    file_id: str = Path(..., description="File UUID v4"),
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
) -> FileIntegrityManifestResponse:
    user_id = current_user.id if current_user else None
    return await files_service.get_integrity_manifest(
        file_id=file_id,
        user_id=user_id,
    )

