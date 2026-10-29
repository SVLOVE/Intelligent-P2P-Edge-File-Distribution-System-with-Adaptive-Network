"""Automated test suite for Phase 4.3: Real File Chunking, SHA-256, and Merkle Tree Integrity."""

import hashlib
import io
import os
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.crypto_service import (
    DEFAULT_CHUNK_SIZE,
    EMPTY_FILE_SHA256,
    EMPTY_TREE_ROOT,
    LEAF_PREFIX,
    NODE_PREFIX,
    ChunkRecord,
    CryptoChunkingService,
    MerkleTree,
    crypto_service,
)
from app.schemas.integrity import ChunkVerifyRequest, ChunkProofElementSchema


# -----------------------------------------------------------------------------
# 1. Chunking Tests
# -----------------------------------------------------------------------------

def test_chunking_empty_file():
    """Verify empty file produces 0 chunks and deterministic empty digests."""
    stream = io.BytesIO(b"")
    whole_sha, merkle_root, chunks, tree = crypto_service.process_binary_stream(stream)

    assert whole_sha == EMPTY_FILE_SHA256
    assert merkle_root == EMPTY_TREE_ROOT
    assert len(chunks) == 0
    assert tree.root == EMPTY_TREE_ROOT


def test_chunking_single_byte():
    """Verify 1-byte file creates exactly 1 chunk of length 1 with correct digests."""
    data = b"X"
    whole_sha, merkle_root, chunks, tree = crypto_service.process_bytes(data)

    assert whole_sha == hashlib.sha256(data).hexdigest().lower()
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].byte_offset == 0
    assert chunks[0].byte_length == 1
    assert chunks[0].sha256_hash == hashlib.sha256(data).hexdigest().lower()
    # Merkle leaf hash is SHA256(0x00 || chunk_bytes)
    expected_leaf = hashlib.sha256(LEAF_PREFIX + data).hexdigest().lower()
    assert chunks[0].merkle_leaf_hash == expected_leaf
    assert merkle_root == expected_leaf


def test_chunking_smaller_than_chunk_size():
    """Verify a payload smaller than 1 MiB creates 1 chunk matching the whole payload."""
    data = b"Intelligent P2P Edge System" * 100  # 2700 bytes
    whole_sha, merkle_root, chunks, tree = crypto_service.process_bytes(data)

    assert len(chunks) == 1
    assert chunks[0].byte_length == len(data)
    assert chunks[0].sha256_hash == hashlib.sha256(data).hexdigest().lower()
    assert whole_sha == hashlib.sha256(data).hexdigest().lower()


def test_chunking_exact_multiple_and_partial_chunks():
    """Verify exact multiple of chunk size has no trailing zero-byte chunk, while non-multiple has partial chunk."""
    chunk_size = 1024  # 1 KiB test chunk size

    # Exact multiple: 3 KiB -> exactly 3 chunks
    exact_data = b"A" * (chunk_size * 3)
    _, _, exact_chunks, _ = crypto_service.process_bytes(exact_data, chunk_size=chunk_size)
    assert len(exact_chunks) == 3
    assert exact_chunks[0].byte_length == chunk_size
    assert exact_chunks[1].byte_length == chunk_size
    assert exact_chunks[2].byte_length == chunk_size

    # Non-multiple: 3 KiB + 500 bytes -> 4 chunks, final chunk length is 500
    partial_data = exact_data + (b"B" * 500)
    _, _, partial_chunks, _ = crypto_service.process_bytes(partial_data, chunk_size=chunk_size)
    assert len(partial_chunks) == 4
    assert partial_chunks[3].byte_length == 500
    assert partial_chunks[3].byte_offset == chunk_size * 3


def test_chunking_arbitrary_binary_and_null_bytes():
    """Verify arbitrary binary payloads including null bytes and non-UTF-8 sequences are preserved byte-for-byte."""
    binary_data = bytes(range(256)) * 16  # 4096 bytes containing all byte values 0x00..0xFF
    whole_sha, merkle_root, chunks, tree = crypto_service.process_bytes(binary_data, chunk_size=1024)

    assert len(chunks) == 4
    # Reassemble bytes
    reassembled_sha = hashlib.sha256(binary_data).hexdigest().lower()
    assert whole_sha == reassembled_sha


def test_chunking_invalid_configuration():
    """Verify invalid chunk size configuration is rejected with ValueError."""
    with pytest.raises(ValueError, match="Chunk size must be positive"):
        crypto_service.process_bytes(b"hello", chunk_size=0)

    with pytest.raises(ValueError, match="exceeds maximum allowable"):
        crypto_service.process_bytes(b"hello", chunk_size=32 * 1024 * 1024)


# -----------------------------------------------------------------------------
# 2. SHA-256 Digest Integrity Tests
# -----------------------------------------------------------------------------

def test_whole_file_and_per_chunk_sha256_match():
    """Verify whole-file SHA-256 matches hashlib exactly, and changing 1 byte alters hashes."""
    original = b"Standard P2P chunk payload test" * 50
    tampered = b"Standard P2P chunk payloae test" * 50  # 1 byte flipped ('d' -> 'e')

    orig_sha, _, orig_chunks, _ = crypto_service.process_bytes(original, chunk_size=200)
    tamp_sha, _, tamp_chunks, _ = crypto_service.process_bytes(tampered, chunk_size=200)

    assert orig_sha == hashlib.sha256(original).hexdigest().lower()
    assert tamp_sha == hashlib.sha256(tampered).hexdigest().lower()
    assert orig_sha != tamp_sha
    assert orig_chunks[0].sha256_hash != tamp_chunks[0].sha256_hash


# -----------------------------------------------------------------------------
# 3. Merkle Tree & Inclusion Proof Tests
# -----------------------------------------------------------------------------

def test_merkle_tree_empty_and_single_leaf():
    """Verify deterministic empty tree root and single-leaf tree properties."""
    empty_tree = MerkleTree([])
    assert empty_tree.root == "dbc1b4c900ffe48d575b5da5c638040125f65db0fe3e24494b76ea986457d986"

    # Single leaf: Leaf is root
    leaf = hashlib.sha256(LEAF_PREFIX + b"single chunk").digest()
    single_tree = MerkleTree([leaf])
    assert single_tree.root == leaf.hex().lower()
    assert single_tree.get_proof(0) == []


def test_merkle_odd_leaf_duplication():
    """Verify Merkle tree construction duplicates final node on odd levels."""
    # 3 leaves: L0, L1, L2.
    # Level 0 has 3 nodes -> odd node L2 is duplicated -> [L0, L1, L2, L2]
    # Level 1 has 2 nodes: H01 = SHA256(0x01 || L0 || L1), H22 = SHA256(0x01 || L2 || L2)
    # Root = SHA256(0x01 || H01 || H22)
    leaves = [
        hashlib.sha256(LEAF_PREFIX + f"chunk_{i}".encode()).digest()
        for i in range(3)
    ]
    tree = MerkleTree(leaves)

    h01 = hashlib.sha256(NODE_PREFIX + leaves[0] + leaves[1]).digest()
    h22 = hashlib.sha256(NODE_PREFIX + leaves[2] + leaves[2]).digest()
    expected_root = hashlib.sha256(NODE_PREFIX + h01 + h22).hexdigest().lower()

    assert tree.root == expected_root


def test_merkle_inclusion_proof_valid_and_tampered():
    """Verify inclusion proofs succeed for all leaves and fail if tampered."""
    chunks = [f"data_block_{i}".encode() * 40 for i in range(7)]  # 7 chunks (odd count)
    leaf_hashes = [hashlib.sha256(LEAF_PREFIX + c).digest() for c in chunks]
    tree = MerkleTree(leaf_hashes)

    # 1. Verify valid proof for every chunk
    for idx, c in enumerate(chunks):
        proof = tree.get_proof(idx)
        valid, reason = MerkleTree.verify_inclusion_proof(c, proof, tree.root)
        assert valid is True, f"Failed for chunk {idx}: {reason}"

    # 2. Tampered chunk bytes must fail verification
    proof_0 = tree.get_proof(0)
    valid, reason = MerkleTree.verify_inclusion_proof(b"tampered_bytes", proof_0, tree.root)
    assert valid is False
    assert "Computed root" in reason or "does not match" in reason

    # 3. Tampered sibling hash in proof must fail
    tampered_proof = list(proof_0)
    tampered_proof[0] = {"position": tampered_proof[0]["position"], "hash": "0" * 64}
    valid, reason = MerkleTree.verify_inclusion_proof(chunks[0], tampered_proof, tree.root)
    assert valid is False

    # 4. Incorrect expected root must fail
    fake_root = "f" * 64
    valid, reason = MerkleTree.verify_inclusion_proof(chunks[0], proof_0, fake_root)
    assert valid is False


def test_merkle_proof_out_of_bounds_index():
    """Verify requesting an out-of-bounds chunk proof raises IndexError."""
    leaf = hashlib.sha256(LEAF_PREFIX + b"test").digest()
    tree = MerkleTree([leaf])

    with pytest.raises(IndexError):
        tree.get_proof(5)
    with pytest.raises(IndexError):
        tree.get_proof(-1)


# -----------------------------------------------------------------------------
# 4. API Endpoints & Security Authorization Tests
# -----------------------------------------------------------------------------

client = TestClient(app)

DEV_TOKEN = "Bearer test-token-00000000-0000-0000-0000-000000000001"



def test_upload_binary_stream_processing_and_verification():
    """Test POST /api/v1/files/process streams raw binary and registers verified manifest."""
    payload = b"Antigravity P2P Edge Streaming Cryptographic Processor" * 1000

    res = client.post(
        "/api/v1/files/process?filename=processed_model.bin",
        content=payload,
        headers={
            "Authorization": DEV_TOKEN,
            "Content-Type": "application/octet-stream",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "processed_model.bin"
    assert data["status"] == "verified"
    assert data["total_size_bytes"] == len(payload)
    assert data["whole_file_sha256"] == hashlib.sha256(payload).hexdigest().lower()
    assert len(data["merkle_root_hash"]) == 64
    assert data["is_simulated"] is False
    assert len(data["chunks"]) >= 1

    file_id = data["file_id"]

    # Retrieve integrity manifest
    manif_res = client.get(f"/api/v1/files/{file_id}/integrity")
    assert manif_res.status_code == 200
    manif_data = manif_res.json()
    assert manif_data["status"] == "verified"
    assert manif_data["whole_file_sha256"] == data["whole_file_sha256"]

    # Retrieve chunk inclusion proof
    proof_res = client.get(f"/api/v1/files/{file_id}/chunks/0/proof")
    assert proof_res.status_code == 200
    proof_data = proof_res.json()
    assert proof_data["chunk_index"] == 0
    assert proof_data["merkle_root"] == data["merkle_root_hash"]

    # Verify chunk using POST /api/v1/files/{file_id}/integrity/verify
    verify_payload = {
        "chunk_index": 0,
        "merkle_leaf_hash": proof_data["merkle_leaf_hash"],
        "proof": proof_data["proof"],
        "expected_merkle_root": proof_data["merkle_root"],
    }
    verify_res = client.post(f"/api/v1/files/{file_id}/integrity/verify", json=verify_payload)
    assert verify_res.status_code == 200
    assert verify_res.json()["verified"] is True


def test_chunk_verification_rejects_untrusted_root():
    """Verify endpoint rejects client-supplied root if it contradicts authoritative manifest."""
    fake_root = "0" * 64
    verify_payload = {
        "chunk_index": 0,
        "merkle_leaf_hash": "1" * 64,
        "proof": [],
        "expected_merkle_root": fake_root,
    }
    res = client.post(
        "/api/v1/files/f47ac10b-58cc-4372-a567-0e02b2c3d479/integrity/verify",
        json=verify_payload,
    )
    assert res.status_code == 200
    assert res.json()["verified"] is False
    assert "does not match" in res.json()["reason"]


def test_unauthenticated_binary_processing_rejected():
    """Verify unauthenticated requests to /files/process return 401."""
    res = client.post(
        "/api/v1/files/process?filename=unauth.bin",
        content=b"test",
    )
    assert res.status_code == 401
