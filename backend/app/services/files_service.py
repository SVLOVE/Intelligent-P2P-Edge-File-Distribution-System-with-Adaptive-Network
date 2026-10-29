import base64
import hashlib
import threading
from typing import BinaryIO, Dict, List, Optional, Tuple
import uuid
from app.core.config import settings
from app.core.exceptions import BadRequestError, ForbiddenError, ResourceConflictError, ResourceNotFoundError
from app.core.supabase import supabase_client
from app.schemas.common import get_utc_now_iso
from app.schemas.files import FileCreateRequest, FileResponse, FileStatus
from app.schemas.integrity import (
    ChunkMetadataSchema,
    ChunkProofElementSchema,
    ChunkProofResponse,
    ChunkVerifyRequest,
    ChunkVerifyResponse,
    FileIntegrityManifestResponse,
)
from app.services.crypto_service import (
    EMPTY_FILE_SHA256,
    EMPTY_TREE_ROOT,
    LEAF_PREFIX,
    NODE_PREFIX,
    MerkleTree,
    crypto_service,
)


class FilesService:
    """Thread-safe file catalog service supporting Supabase persistence with in-memory fallback."""

    def __init__(self):
        self._lock = threading.Lock()
        self._files: Dict[str, FileResponse] = {}
        self._hash_to_id: Dict[str, str] = {}
        self._file_chunks: Dict[str, List[ChunkMetadataSchema]] = {}
        self._seed_initial_data()

    def _seed_initial_data(self) -> None:
        """Seed initial development dataset."""
        initial_records = [
            FileResponse(
                file_id="f47ac10b-58cc-4372-a567-0e02b2c3d479",
                owner_id="00000000-0000-0000-0000-000000000001",
                name="edge_model_weights.bin",
                mime_type="application/octet-stream",
                total_size_bytes=104857600,
                chunk_size_bytes=1048576,
                total_chunks=100,
                sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                whole_file_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                merkle_root_hash="8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
                status=FileStatus.ACTIVE,
                active_seeders=4,
                is_simulated=True,
                storage_notice="Metadata-only registration. Binary file bytes have not been uploaded.",
                created_at="2026-10-29T21:00:00Z",
                updated_at="2026-10-29T21:00:00Z",
            ),
            FileResponse(
                file_id="b183ce52-974a-4e2a-8991-628d011245fa",
                owner_id="00000000-0000-0000-0000-000000000001",
                name="training_dataset_shard_01.tar.gz",
                mime_type="application/gzip",
                total_size_bytes=209715200,
                chunk_size_bytes=1048576,
                total_chunks=200,
                sha256_hash="ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
                whole_file_sha256="ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
                merkle_root_hash="4a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef0123",
                status=FileStatus.ACTIVE,
                active_seeders=2,
                is_simulated=True,
                storage_notice="Metadata-only registration. Binary file bytes have not been uploaded.",
                created_at="2026-10-29T21:15:00Z",
                updated_at="2026-10-29T21:15:00Z",
            ),
        ]
        for f in initial_records:
            self._files[f.file_id] = f
            if f.whole_file_sha256:
                self._hash_to_id[f.whole_file_sha256.lower()] = f.file_id

    async def list_files(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[FileStatus] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[List[FileResponse], int]:
        """Return paginated list of registered files, respecting ownership or public visibility."""
        if settings.is_supabase_configured:
            records, total = await supabase_client.list_files(
                page=page,
                limit=limit,
                status=status.value if status else None,
                owner_id=user_id,
            )
            items = []
            for r in records:
                status_raw = r.get("status", "metadata_only")
                st = FileStatus(status_raw) if status_raw in FileStatus._value2member_map_ else FileStatus.METADATA_ONLY
                items.append(
                    FileResponse(
                        file_id=r.get("id"),
                        owner_id=r.get("owner_id"),
                        name=r.get("name"),
                        mime_type=r.get("mime_type", "application/octet-stream"),
                        total_size_bytes=r.get("size_bytes", 0),
                        chunk_size_bytes=settings.DEFAULT_CHUNK_SIZE_BYTES,
                        total_chunks=max(1, (r.get("size_bytes", 0) + settings.DEFAULT_CHUNK_SIZE_BYTES - 1) // settings.DEFAULT_CHUNK_SIZE_BYTES),
                        sha256_hash=r.get("whole_file_sha256"),
                        whole_file_sha256=r.get("whole_file_sha256"),
                        merkle_root_hash=r.get("merkle_root_hash"),
                        status=st,
                        active_seeders=0,
                        is_simulated=False,
                        storage_notice="Authoritative metadata persisted in Supabase PostgreSQL.",
                        created_at=r.get("created_at", get_utc_now_iso()),
                        updated_at=r.get("updated_at", get_utc_now_iso()),
                    )
                )
            return items, total

        with self._lock:
            all_files = list(self._files.values())

        filtered = []
        for f in all_files:
            if user_id:
                if f.owner_id != user_id and f.status not in (FileStatus.ACTIVE, FileStatus.AVAILABLE, FileStatus.VERIFIED):
                    continue
            if status and f.status != status:
                continue
            filtered.append(f)

        total = len(filtered)
        start = (page - 1) * limit
        end = start + limit
        items = filtered[start:end]
        return items, total

    async def get_file(self, file_id: str, user_id: Optional[str] = None) -> FileResponse:
        """Retrieve a registered file, enforcing ownership/visibility boundaries."""
        if settings.is_supabase_configured:
            record = await supabase_client.get_file(file_id)
            if not record:
                raise ResourceNotFoundError(resource="File", resource_id=file_id)
            
            status_val = record.get("status")
            owner_val = record.get("owner_id")
            if user_id and owner_val != user_id and status_val not in ("available", "active", "verified"):
                raise ResourceNotFoundError(resource="File", resource_id=file_id)

            st = FileStatus(status_val) if status_val in FileStatus._value2member_map_ else FileStatus.METADATA_ONLY
            return FileResponse(
                file_id=record.get("id"),
                owner_id=record.get("owner_id"),
                name=record.get("name"),
                mime_type=record.get("mime_type", "application/octet-stream"),
                total_size_bytes=record.get("size_bytes", 0),
                chunk_size_bytes=settings.DEFAULT_CHUNK_SIZE_BYTES,
                total_chunks=max(1, (record.get("size_bytes", 0) + settings.DEFAULT_CHUNK_SIZE_BYTES - 1) // settings.DEFAULT_CHUNK_SIZE_BYTES),
                sha256_hash=record.get("whole_file_sha256"),
                whole_file_sha256=record.get("whole_file_sha256"),
                merkle_root_hash=record.get("merkle_root_hash"),
                status=st,
                active_seeders=0,
                is_simulated=False,
                storage_notice="Authoritative metadata persisted in Supabase PostgreSQL.",
                created_at=record.get("created_at", get_utc_now_iso()),
                updated_at=record.get("updated_at", get_utc_now_iso()),
            )

        with self._lock:
            file_record = self._files.get(file_id)

        if not file_record:
            raise ResourceNotFoundError(resource="File", resource_id=file_id)

        if user_id and file_record.owner_id and file_record.owner_id != user_id:
            if file_record.status not in (FileStatus.ACTIVE, FileStatus.AVAILABLE, FileStatus.VERIFIED):
                raise ResourceNotFoundError(resource="File", resource_id=file_id)

        return file_record

    async def create_file(self, request: FileCreateRequest, owner_id: str) -> FileResponse:
        """Register a new file publication record with honest metadata_only status."""
        if request.total_size_bytes > settings.MAX_FILE_SIZE_BYTES:
            raise BadRequestError(
                f"File total_size_bytes ({request.total_size_bytes}) exceeds maximum allowed ({settings.MAX_FILE_SIZE_BYTES}).",
                code="FILE_SIZE_EXCEEDED",
            )

        target_hash = request.whole_file_sha256 or request.sha256_hash
        hash_norm = target_hash.lower() if target_hash else None

        if settings.is_supabase_configured:
            new_id = str(uuid.uuid4())
            record_dict = {
                "id": new_id,
                "owner_id": owner_id,
                "name": request.name,
                "size_bytes": request.total_size_bytes,
                "mime_type": request.mime_type,
                "status": "metadata_only",
                "whole_file_sha256": hash_norm,
                "merkle_root_hash": request.merkle_root_hash.lower() if request.merkle_root_hash else None,
            }
            res = await supabase_client.insert_file(record_dict)
            now = get_utc_now_iso()
            return FileResponse(
                file_id=new_id,
                owner_id=owner_id,
                name=request.name,
                mime_type=request.mime_type,
                total_size_bytes=request.total_size_bytes,
                chunk_size_bytes=request.chunk_size_bytes,
                total_chunks=request.total_chunks,
                sha256_hash=target_hash,
                whole_file_sha256=target_hash,
                merkle_root_hash=request.merkle_root_hash,
                status=FileStatus.METADATA_ONLY,
                active_seeders=0,
                is_simulated=False,
                storage_notice="Metadata-only registration. Binary file bytes have not been uploaded.",
                created_at=res.get("created_at", now),
                updated_at=res.get("updated_at", now),
            )

        with self._lock:
            if hash_norm and hash_norm in self._hash_to_id:
                existing_id = self._hash_to_id[hash_norm]
                raise ResourceConflictError(
                    f"A file with SHA-256 hash '{target_hash}' is already registered (id: {existing_id}).",
                    code="FILE_HASH_ALREADY_REGISTERED",
                    details={"existing_file_id": existing_id, "sha256_hash": target_hash},
                )

            new_id = str(uuid.uuid4())
            now = get_utc_now_iso()
            record = FileResponse(
                file_id=new_id,
                owner_id=owner_id,
                name=request.name,
                mime_type=request.mime_type,
                total_size_bytes=request.total_size_bytes,
                chunk_size_bytes=request.chunk_size_bytes,
                total_chunks=request.total_chunks,
                sha256_hash=target_hash,
                whole_file_sha256=target_hash,
                merkle_root_hash=request.merkle_root_hash,
                status=FileStatus.METADATA_ONLY,
                active_seeders=0,
                is_simulated=True,
                storage_notice="Metadata-only registration (in-memory development). Binary file bytes have not been uploaded.",
                created_at=now,
                updated_at=now,
            )
            self._files[new_id] = record
            if hash_norm:
                self._hash_to_id[hash_norm] = new_id

        return record

    async def register_chunks(
        self,
        file_id: str,
        chunks: List[ChunkMetadataSchema],
        user_id: str,
    ) -> int:
        """Register ordered chunk descriptors for an existing file."""
        file_record = await self.get_file(file_id, user_id=user_id)
        if file_record.owner_id and file_record.owner_id != user_id:
            raise ForbiddenError("Only the file owner can register chunk manifests.")

        sorted_chunks = sorted(chunks, key=lambda c: c.chunk_index)

        if settings.is_supabase_configured:
            records = [
                {
                    "file_id": file_id,
                    "chunk_index": c.chunk_index,
                    "byte_offset": c.byte_offset,
                    "byte_length": c.byte_length,
                    "sha256_hash": c.sha256_hash.lower(),
                    "merkle_leaf_hash": c.merkle_leaf_hash.lower() if c.merkle_leaf_hash else None,
                }
                for c in sorted_chunks
            ]
            await supabase_client.insert_chunks(records)

        with self._lock:
            self._file_chunks[file_id] = sorted_chunks

        return len(sorted_chunks)

    async def list_chunks(
        self,
        file_id: str,
        page: int = 1,
        limit: int = 50,
        user_id: Optional[str] = None,
    ) -> Tuple[List[ChunkMetadataSchema], int, bool]:
        """Fetch paginated chunk metadata descriptors for a registered file."""
        file_record = await self.get_file(file_id, user_id=user_id)

        if settings.is_supabase_configured:
            records, total = await supabase_client.list_chunks(file_id, page=page, limit=limit)
            if records:
                items = [
                    ChunkMetadataSchema(
                        chunk_index=r["chunk_index"],
                        byte_offset=r["byte_offset"],
                        byte_length=r["byte_length"],
                        sha256_hash=r["sha256_hash"],
                        merkle_leaf_hash=r.get("merkle_leaf_hash"),
                    )
                    for r in records
                ]
                return items, total, False

        with self._lock:
            chunks = self._file_chunks.get(file_id)

        if chunks:
            total = len(chunks)
            start = (page - 1) * limit
            end = start + limit
            return chunks[start:end], total, file_record.is_simulated

        # If file is simulated mock fixture and has no explicit chunks, generate simulated descriptors
        if file_record.is_simulated:
            total = file_record.total_chunks
            chunk_size = file_record.chunk_size_bytes or settings.DEFAULT_CHUNK_SIZE_BYTES
            start = (page - 1) * limit
            end = min(total, start + limit)
            sim_items = []
            for i in range(start, end):
                offset = i * chunk_size
                length = min(chunk_size, max(0, file_record.total_size_bytes - offset))
                sim_items.append(
                    ChunkMetadataSchema(
                        chunk_index=i,
                        byte_offset=offset,
                        byte_length=length if length > 0 else chunk_size,
                        sha256_hash=f"{i:08x}" * 8,
                        merkle_leaf_hash=None,
                    )
                )
            return sim_items, total, True

        return [], 0, False

    async def get_chunk_proof(
        self,
        file_id: str,
        chunk_index: int,
        user_id: Optional[str] = None,
    ) -> ChunkProofResponse:
        """Generate Merkle inclusion proof for a chunk against the authoritative Merkle root."""
        file_record = await self.get_file(file_id, user_id=user_id)

        all_chunks: List[ChunkMetadataSchema] = []
        if settings.is_supabase_configured:
            raw_records = await supabase_client.get_all_chunks(file_id)
            if raw_records:
                all_chunks = [
                    ChunkMetadataSchema(
                        chunk_index=r["chunk_index"],
                        byte_offset=r["byte_offset"],
                        byte_length=r["byte_length"],
                        sha256_hash=r["sha256_hash"],
                        merkle_leaf_hash=r.get("merkle_leaf_hash"),
                    )
                    for r in raw_records
                ]

        if not all_chunks:
            with self._lock:
                all_chunks = list(self._file_chunks.get(file_id, []))

        if not all_chunks:
            raise ResourceNotFoundError(
                resource="Chunk Manifest",
                resource_id=f"{file_id} (No real chunk manifest found for proof generation)",
            )

        if chunk_index < 0 or chunk_index >= len(all_chunks):
            raise BadRequestError(
                f"Chunk index {chunk_index} out of bounds (file has {len(all_chunks)} chunks).",
                code="CHUNK_INDEX_OUT_OF_BOUNDS",
            )

        target_chunk = all_chunks[chunk_index]

        # Convert leaf hashes to bytes
        leaf_hashes: List[bytes] = []
        for c in all_chunks:
            if c.merkle_leaf_hash:
                leaf_hashes.append(bytes.fromhex(c.merkle_leaf_hash))
            else:
                # If merkle_leaf_hash was not precalculated, derive from chunk SHA-256
                leaf_hashes.append(bytes.fromhex(c.sha256_hash))

        tree = MerkleTree(leaf_hashes)
        proof_steps = tree.get_proof(chunk_index)

        return ChunkProofResponse(
            file_id=file_id,
            chunk_index=chunk_index,
            chunk_sha256=target_chunk.sha256_hash,
            merkle_leaf_hash=target_chunk.merkle_leaf_hash or target_chunk.sha256_hash,
            merkle_root=file_record.merkle_root_hash or tree.root,
            proof=[ChunkProofElementSchema(position=p["position"], hash=p["hash"]) for p in proof_steps],
        )

    async def verify_chunk(
        self,
        file_id: str,
        request: ChunkVerifyRequest,
        user_id: Optional[str] = None,
    ) -> ChunkVerifyResponse:
        """Verify a supplied chunk and Merkle proof against the authoritative root."""
        file_record = await self.get_file(file_id, user_id=user_id)

        # 1. Authoritative root validation: Reject untrusted client roots
        expected_root = request.expected_merkle_root.lower()
        if file_record.merkle_root_hash:
            if expected_root != file_record.merkle_root_hash.lower():
                return ChunkVerifyResponse(
                    file_id=file_id,
                    chunk_index=request.chunk_index,
                    verified=False,
                    reason=f"Supplied expected root '{request.expected_merkle_root}' does not match file authoritative root '{file_record.merkle_root_hash}'.",
                    computed_root="",
                    expected_root=file_record.merkle_root_hash,
                )

        proof_dicts = [{"position": p.position, "hash": p.hash.lower()} for p in request.proof]

        # 2. Case A: Actual chunk payload bytes provided in base64
        if request.chunk_data_base64:
            try:
                chunk_bytes = base64.b64decode(request.chunk_data_base64)
            except Exception as exc:
                return ChunkVerifyResponse(
                    file_id=file_id,
                    chunk_index=request.chunk_index,
                    verified=False,
                    reason=f"Failed to decode chunk_data_base64: {str(exc)}",
                    computed_root="",
                    expected_root=expected_root,
                )

            # Optional check: chunk SHA-256 match
            if request.chunk_sha256:
                computed_chunk_sha = hashlib.sha256(chunk_bytes).hexdigest().lower()
                if computed_chunk_sha != request.chunk_sha256.lower():
                    return ChunkVerifyResponse(
                        file_id=file_id,
                        chunk_index=request.chunk_index,
                        verified=False,
                        reason=f"Chunk data SHA-256 digest '{computed_chunk_sha}' does not match claimed '{request.chunk_sha256.lower()}'.",
                        computed_root="",
                        expected_root=expected_root,
                    )

            is_valid, reason = MerkleTree.verify_inclusion_proof(chunk_bytes, proof_dicts, expected_root)
            return ChunkVerifyResponse(
                file_id=file_id,
                chunk_index=request.chunk_index,
                verified=is_valid,
                reason=reason,
                computed_root=expected_root if is_valid else "",
                expected_root=expected_root,
            )

        # 3. Case B: Leaf hash provided without binary payload
        leaf_hex = request.merkle_leaf_hash or request.chunk_sha256
        if not leaf_hex or len(leaf_hex) != 64:
            return ChunkVerifyResponse(
                file_id=file_id,
                chunk_index=request.chunk_index,
                verified=False,
                reason="Verification requires either chunk_data_base64 or valid 64-char hexadecimal merkle_leaf_hash.",
                computed_root="",
                expected_root=expected_root,
            )

        try:
            cur_hash = bytes.fromhex(leaf_hex)
        except ValueError:
            return ChunkVerifyResponse(
                file_id=file_id,
                chunk_index=request.chunk_index,
                verified=False,
                reason="Invalid hexadecimal character sequence in leaf hash.",
                computed_root="",
                expected_root=expected_root,
            )

        if not proof_dicts:
            computed_root = cur_hash.hex().lower()
            valid = (computed_root == expected_root)
            return ChunkVerifyResponse(
                file_id=file_id,
                chunk_index=request.chunk_index,
                verified=valid,
                reason=None if valid else "Single leaf hash does not match root.",
                computed_root=computed_root,
                expected_root=expected_root,
            )

        for step_idx, step in enumerate(proof_dicts):
            pos = step["position"]
            sib_hex = step["hash"]
            if pos not in ("left", "right"):
                return ChunkVerifyResponse(
                    file_id=file_id,
                    chunk_index=request.chunk_index,
                    verified=False,
                    reason=f"Invalid sibling position '{pos}' at step {step_idx}.",
                    computed_root="",
                    expected_root=expected_root,
                )
            try:
                sib_bytes = bytes.fromhex(sib_hex)
            except ValueError:
                return ChunkVerifyResponse(
                    file_id=file_id,
                    chunk_index=request.chunk_index,
                    verified=False,
                    reason=f"Invalid hexadecimal sibling hash at step {step_idx}.",
                    computed_root="",
                    expected_root=expected_root,
                )

            if pos == "left":
                cur_hash = hashlib.sha256(NODE_PREFIX + sib_bytes + cur_hash).digest()
            else:
                cur_hash = hashlib.sha256(NODE_PREFIX + cur_hash + sib_bytes).digest()

        computed_root = cur_hash.hex().lower()
        verified = (computed_root == expected_root)
        return ChunkVerifyResponse(
            file_id=file_id,
            chunk_index=request.chunk_index,
            verified=verified,
            reason=None if verified else f"Computed root '{computed_root}' != expected '{expected_root}'.",
            computed_root=computed_root,
            expected_root=expected_root,
        )

    async def process_file_binary(
        self,
        filename: str,
        mime_type: str,
        stream: BinaryIO,
        owner_id: str,
    ) -> FileIntegrityManifestResponse:
        """Stream real binary bytes, compute SHA-256 and Merkle tree, and persist genuine verified records."""
        whole_sha256, merkle_root, chunk_records, tree = crypto_service.process_binary_stream(
            stream,
            chunk_size=settings.DEFAULT_CHUNK_SIZE_BYTES,
        )

        total_size = sum(c.byte_length for c in chunk_records)
        chunk_count = len(chunk_records)
        new_file_id = str(uuid.uuid4())
        now = get_utc_now_iso()

        chunks_schema = [
            ChunkMetadataSchema(
                chunk_index=c.chunk_index,
                byte_offset=c.byte_offset,
                byte_length=c.byte_length,
                sha256_hash=c.sha256_hash,
                merkle_leaf_hash=c.merkle_leaf_hash,
            )
            for c in chunk_records
        ]

        if settings.is_supabase_configured:
            file_dict = {
                "id": new_file_id,
                "owner_id": owner_id,
                "name": filename,
                "size_bytes": total_size if total_size > 0 else 1,  # DB check > 0
                "mime_type": mime_type,
                "status": "verified",
                "whole_file_sha256": whole_sha256,
                "merkle_root_hash": merkle_root,
            }
            await supabase_client.insert_file(file_dict)
            if chunk_records:
                chunk_dicts = [
                    {
                        "file_id": new_file_id,
                        "chunk_index": c.chunk_index,
                        "byte_offset": c.byte_offset,
                        "byte_length": c.byte_length,
                        "sha256_hash": c.sha256_hash,
                        "merkle_leaf_hash": c.merkle_leaf_hash,
                    }
                    for c in chunk_records
                ]
                await supabase_client.insert_chunks(chunk_dicts)

        file_resp = FileResponse(
            file_id=new_file_id,
            owner_id=owner_id,
            name=filename,
            mime_type=mime_type,
            total_size_bytes=total_size,
            chunk_size_bytes=settings.DEFAULT_CHUNK_SIZE_BYTES,
            total_chunks=chunk_count,
            sha256_hash=whole_sha256,
            whole_file_sha256=whole_sha256,
            merkle_root_hash=merkle_root,
            status=FileStatus.VERIFIED,
            active_seeders=1,
            is_simulated=False,
            storage_notice="Cryptographically verified: genuine whole-file SHA-256 and Merkle tree constructed from binary stream.",
            created_at=now,
            updated_at=now,
        )

        with self._lock:
            self._files[new_file_id] = file_resp
            self._hash_to_id[whole_sha256] = new_file_id
            self._file_chunks[new_file_id] = chunks_schema

        return FileIntegrityManifestResponse(
            file_id=new_file_id,
            name=filename,
            status="verified",
            total_size_bytes=total_size,
            chunk_size_bytes=settings.DEFAULT_CHUNK_SIZE_BYTES,
            total_chunks=chunk_count,
            whole_file_sha256=whole_sha256,
            merkle_root_hash=merkle_root,
            algorithm="SHA-256",
            merkle_encoding="v1-domain-separated-rfc6962-style",
            chunks=chunks_schema,
            is_simulated=False,
        )

    async def get_integrity_manifest(
        self,
        file_id: str,
        user_id: Optional[str] = None,
    ) -> FileIntegrityManifestResponse:
        """Retrieve complete authoritative cryptographic integrity manifest for a file."""
        file_record = await self.get_file(file_id, user_id=user_id)

        all_chunks: List[ChunkMetadataSchema] = []
        if settings.is_supabase_configured:
            raw_records = await supabase_client.get_all_chunks(file_id)
            if raw_records:
                all_chunks = [
                    ChunkMetadataSchema(
                        chunk_index=r["chunk_index"],
                        byte_offset=r["byte_offset"],
                        byte_length=r["byte_length"],
                        sha256_hash=r["sha256_hash"],
                        merkle_leaf_hash=r.get("merkle_leaf_hash"),
                    )
                    for r in raw_records
                ]

        if not all_chunks:
            with self._lock:
                all_chunks = list(self._file_chunks.get(file_id, []))

        # If simulated mock without stored chunks, generate simulated chunks
        if not all_chunks and file_record.is_simulated:
            chunk_size = file_record.chunk_size_bytes or settings.DEFAULT_CHUNK_SIZE_BYTES
            for i in range(min(file_record.total_chunks, 100)):
                offset = i * chunk_size
                length = min(chunk_size, max(0, file_record.total_size_bytes - offset))
                all_chunks.append(
                    ChunkMetadataSchema(
                        chunk_index=i,
                        byte_offset=offset,
                        byte_length=length if length > 0 else chunk_size,
                        sha256_hash=f"{i:08x}" * 8,
                        merkle_leaf_hash=None,
                    )
                )

        status_str = file_record.status.value if hasattr(file_record.status, "value") else str(file_record.status)
        return FileIntegrityManifestResponse(
            file_id=file_id,
            name=file_record.name,
            status=status_str,
            total_size_bytes=file_record.total_size_bytes,
            chunk_size_bytes=file_record.chunk_size_bytes,
            total_chunks=file_record.total_chunks,
            whole_file_sha256=file_record.whole_file_sha256 or file_record.sha256_hash or "",
            merkle_root_hash=file_record.merkle_root_hash or "",
            algorithm="SHA-256",
            merkle_encoding="v1-domain-separated-rfc6962-style",
            chunks=all_chunks,
            is_simulated=file_record.is_simulated,
        )


files_service = FilesService()

