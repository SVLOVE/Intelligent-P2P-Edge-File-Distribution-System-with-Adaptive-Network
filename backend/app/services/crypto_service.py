"""Cryptographic file chunking, SHA-256 digests, and Merkle tree implementation."""

from dataclasses import dataclass
import hashlib
import io
import math
from typing import BinaryIO, Dict, List, Optional, Tuple

# Domain separation prefixes conforming to RFC 6962 / academic Merkle tree standards
LEAF_PREFIX = b"\x00"
NODE_PREFIX = b"\x01"
EMPTY_ROOT_PREFIX = b"\x02"

# Deterministic root for zero-byte / empty files: SHA256(0x02)
EMPTY_TREE_ROOT = hashlib.sha256(EMPTY_ROOT_PREFIX).hexdigest()
EMPTY_FILE_SHA256 = hashlib.sha256(b"").hexdigest()

DEFAULT_CHUNK_SIZE = 1048576  # 1 MiB standard chunk size
MAX_CHUNK_SIZE = 16 * 1024 * 1024  # 16 MiB maximum chunk size


@dataclass
class ChunkRecord:
    """Individual chunk cryptographic descriptor."""

    chunk_index: int
    byte_offset: int
    byte_length: int
    sha256_hash: str  # Ordinary SHA256(chunk_bytes)
    merkle_leaf_hash: str  # Domain-separated SHA256(0x00 || chunk_bytes)


@dataclass
class MerkleProofElement:
    """Single sibling step in a Merkle inclusion proof."""

    position: str  # 'left' or 'right'
    hash: str  # 64-char lowercase hexadecimal hash


class MerkleTree:
    """
    Deterministic binary Merkle Tree with domain separation and odd-node duplication.
    
    Encoding Rules:
      - Leaf Hash: SHA256(0x00 || chunk_bytes)
      - Internal Node Hash: SHA256(0x01 || left_hash || right_hash)
      - Empty File Root: SHA256(0x02) = dbc1b4c900ffe48d575b5da5c638040125f65db0fe3e24494b76ea986457d986
      - Odd Nodes: If a level has an odd number of nodes (> 1), the final node is duplicated.
    """

    def __init__(self, leaf_hashes: List[bytes]):
        self._leaf_hashes = leaf_hashes
        self._levels: List[List[bytes]] = []
        self._build_tree()

    def _build_tree(self) -> None:
        if not self._leaf_hashes:
            self._root = EMPTY_TREE_ROOT
            self._levels = []
            return

        # Level 0 is the list of leaf hashes
        current = list(self._leaf_hashes)
        self._levels.append(current)

        while len(current) > 1:
            # Odd node duplication rule
            if len(current) % 2 != 0:
                current.append(current[-1])

            next_level = []
            for i in range(0, len(current), 2):
                combined = hashlib.sha256(NODE_PREFIX + current[i] + current[i + 1]).digest()
                next_level.append(combined)

            self._levels.append(next_level)
            current = next_level

        self._root = self._levels[-1][0].hex().lower()

    @property
    def root(self) -> str:
        """Return the 64-character lowercase hexadecimal Merkle root."""
        return self._root

    def get_proof(self, chunk_index: int) -> List[Dict[str, str]]:
        """
        Generate Merkle inclusion proof for a specified chunk index.
        Returns a list of sibling descriptors: [{'position': 'left'|'right', 'hash': '...'}]
        """
        if not self._leaf_hashes:
            raise ValueError("Cannot generate inclusion proof for an empty tree.")

        if chunk_index < 0 or chunk_index >= len(self._leaf_hashes):
            raise IndexError(f"Chunk index {chunk_index} out of range [0, {len(self._leaf_hashes)-1}].")

        if len(self._leaf_hashes) == 1:
            # Single leaf is the root itself; proof is empty path
            return []

        proof: List[Dict[str, str]] = []
        cur_idx = chunk_index

        for level in self._levels[:-1]:
            cur_level = list(level)
            if len(cur_level) % 2 != 0:
                cur_level.append(cur_level[-1])

            if cur_idx % 2 == 0:
                # Target is left child, sibling is right
                sibling_idx = cur_idx + 1
                proof.append({"position": "right", "hash": cur_level[sibling_idx].hex().lower()})
            else:
                # Target is right child, sibling is left
                sibling_idx = cur_idx - 1
                proof.append({"position": "left", "hash": cur_level[sibling_idx].hex().lower()})

            cur_idx //= 2

        return proof

    @staticmethod
    def verify_inclusion_proof(
        chunk_bytes: bytes,
        proof: List[Dict[str, str]],
        expected_root: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify that chunk_bytes belongs to the tree represented by expected_root using proof.
        Returns (is_valid: bool, error_reason: Optional[str]).
        """
        # 1. Validate expected root format
        if not expected_root or len(expected_root) != 64:
            return False, "Invalid expected root hash format (must be 64 hexadecimal characters)."

        try:
            bytes.fromhex(expected_root)
        except ValueError:
            return False, "Expected root is not valid hexadecimal."

        # 2. Compute leaf hash with domain separation prefix 0x00
        cur_hash = hashlib.sha256(LEAF_PREFIX + chunk_bytes).digest()

        # 3. Special case: empty proof
        if not proof:
            # Single leaf tree: leaf hash must match expected root
            if cur_hash.hex().lower() == expected_root.lower():
                return True, None
            # Or empty file
            if chunk_bytes == b"" and expected_root.lower() == EMPTY_TREE_ROOT:
                return True, None
            return False, "Single leaf hash does not match expected root."

        # 4. Traverse proof audit path
        for step_idx, step in enumerate(proof):
            if not isinstance(step, dict) or "position" not in step or "hash" not in step:
                return False, f"Malformed proof element at step {step_idx}: missing position or hash."

            pos = step["position"]
            sib_hex = step["hash"]

            if pos not in ("left", "right"):
                return False, f"Invalid sibling position '{pos}' at step {step_idx}."

            if len(sib_hex) != 64:
                return False, f"Invalid sibling hash length ({len(sib_hex)}) at step {step_idx}."

            try:
                sib_bytes = bytes.fromhex(sib_hex)
            except ValueError:
                return False, f"Invalid hexadecimal sibling hash at step {step_idx}."

            if pos == "left":
                cur_hash = hashlib.sha256(NODE_PREFIX + sib_bytes + cur_hash).digest()
            else:
                cur_hash = hashlib.sha256(NODE_PREFIX + cur_hash + sib_bytes).digest()

        computed_root = cur_hash.hex().lower()
        if computed_root == expected_root.lower():
            return True, None
        return False, f"Proof verification failed. Computed root '{computed_root}' != expected '{expected_root.lower()}'."


class CryptoChunkingService:
    """Service providing streaming file chunking, SHA-256 calculation, and Merkle tree generation."""

    @staticmethod
    def process_binary_stream(
        stream: BinaryIO,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
    ) -> Tuple[str, str, List[ChunkRecord], MerkleTree]:
        """
        Read binary stream incrementally with bounded memory usage.
        
        Returns:
            - whole_file_sha256 (str): 64-character lowercase hex digest of entire stream
            - merkle_root (str): 64-character lowercase hex Merkle tree root
            - chunks (List[ChunkRecord]): metadata for each 1 MiB chunk
            - tree (MerkleTree): the constructed Merkle tree
        """
        if chunk_size <= 0:
            raise ValueError(f"Chunk size must be positive (got {chunk_size}).")
        if chunk_size > MAX_CHUNK_SIZE:
            raise ValueError(f"Chunk size {chunk_size} exceeds maximum allowable {MAX_CHUNK_SIZE} bytes.")

        whole_hasher = hashlib.sha256()
        chunk_records: List[ChunkRecord] = []
        leaf_hashes: List[bytes] = []

        chunk_idx = 0
        byte_offset = 0

        while True:
            # Read exact chunk slice (bounded in memory to chunk_size)
            chunk_data = stream.read(chunk_size)
            if not chunk_data:
                break

            # Update whole file digest
            whole_hasher.update(chunk_data)

            # Calculate ordinary per-chunk SHA-256
            chunk_sha256 = hashlib.sha256(chunk_data).hexdigest().lower()

            # Calculate domain-separated leaf hash
            leaf_hash_bytes = hashlib.sha256(LEAF_PREFIX + chunk_data).digest()
            leaf_hashes.append(leaf_hash_bytes)

            chunk_records.append(
                ChunkRecord(
                    chunk_index=chunk_idx,
                    byte_offset=byte_offset,
                    byte_length=len(chunk_data),
                    sha256_hash=chunk_sha256,
                    merkle_leaf_hash=leaf_hash_bytes.hex().lower(),
                )
            )

            byte_offset += len(chunk_data)
            chunk_idx += 1

        # Handle empty stream
        if byte_offset == 0:
            tree = MerkleTree([])
            return EMPTY_FILE_SHA256, EMPTY_TREE_ROOT, [], tree

        tree = MerkleTree(leaf_hashes)
        return whole_hasher.hexdigest().lower(), tree.root, chunk_records, tree

    @classmethod
    def process_bytes(
        cls,
        data: bytes,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
    ) -> Tuple[str, str, List[ChunkRecord], MerkleTree]:
        """Process byte buffer in memory."""
        return cls.process_binary_stream(io.BytesIO(data), chunk_size=chunk_size)


crypto_service = CryptoChunkingService()
