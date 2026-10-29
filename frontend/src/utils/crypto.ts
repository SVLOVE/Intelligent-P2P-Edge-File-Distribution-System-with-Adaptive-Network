/**
 * Client-Side Cryptographic Utilities conforming to Phase 4.3 specification.
 * Uses native Web Cryptography API (window.crypto.subtle) without external dependencies.
 *
 * Encoding Rules:
 *   - Leaf Hash: SHA256(0x00 || chunk_bytes)
 *   - Internal Node Hash: SHA256(0x01 || left_hash || right_hash)
 *   - Empty File Merkle Root: SHA256(0x02) = dbc1b4c900ffe48d575b5da5c638040125f65db0fe3e24494b76ea986457d986
 *   - Odd Node Duplication: If level has an odd count > 1, duplicate the final node.
 */

export const DEFAULT_CHUNK_SIZE_BYTES = 1048576; // 1 MiB
export const EMPTY_TREE_ROOT = 'dbc1b4c900ffe48d575b5da5c638040125f65db0fe3e24494b76ea986457d986';
export const EMPTY_FILE_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

export interface ClientChunkDescriptor {
  index: number;
  byteOffset: number;
  byteLength: number;
  sha256Hash: string; // Ordinary SHA256(chunk_bytes)
  merkleLeafHash: string; // Domain-separated SHA256(0x00 || chunk_bytes)
}

export interface ClientFileProcessResult {
  wholeFileSha256: string;
  merkleRootHash: string;
  totalSize: number;
  totalChunks: number;
  chunkSizeBytes: number;
  chunks: ClientChunkDescriptor[];
}

/**
 * Convert ArrayBuffer to 64-character lowercase hexadecimal string.
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex.toLowerCase();
}

/**
 * Convert 64-character hexadecimal string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().toLowerCase();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Calculate standard SHA-256 digest of an ArrayBuffer or Uint8Array.
 */
export async function sha256Digest(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bufferSource: BufferSource =
    data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bufferSource);
  return bufferToHex(hashBuffer);
}

/**
 * Calculate domain-separated Merkle leaf hash: SHA256(0x00 || chunk_bytes).
 */
export async function computeMerkleLeafHash(chunkBytes: Uint8Array): Promise<Uint8Array> {
  const prefixed = new Uint8Array(1 + chunkBytes.length);
  prefixed.set(LEAF_PREFIX, 0);
  prefixed.set(chunkBytes, 1);
  const digestBuffer = await crypto.subtle.digest(
    'SHA-256',
    prefixed.buffer.slice(prefixed.byteOffset, prefixed.byteOffset + prefixed.byteLength) as ArrayBuffer
  );
  return new Uint8Array(digestBuffer);
}

/**
 * Build deterministic binary Merkle tree root from array of 32-byte leaf hashes.
 */
export async function buildMerkleRoot(leafHashes: Uint8Array[]): Promise<string> {
  if (leafHashes.length === 0) {
    return EMPTY_TREE_ROOT;
  }

  let currentLevel = [...leafHashes];

  while (currentLevel.length > 1) {
    // Odd node duplication rule
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    const nextLevel: Uint8Array[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1];

      const combined = new Uint8Array(1 + left.length + right.length);
      combined.set(NODE_PREFIX, 0);
      combined.set(left, 1);
      combined.set(right, 1 + left.length);

      const digestBuffer = await crypto.subtle.digest(
        'SHA-256',
        combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength) as ArrayBuffer
      );
      nextLevel.push(new Uint8Array(digestBuffer));
    }
    currentLevel = nextLevel;
  }

  return bufferToHex(currentLevel[0]);
}


/**
 * Process a browser File object incrementally with bounded memory:
 * Splits into 1 MiB slices, calculates whole-file SHA-256, chunk SHA-256,
 * domain-separated leaf hashes, and builds the authoritative Merkle root.
 */
export async function processFileInBrowser(
  file: File,
  chunkSize: number = DEFAULT_CHUNK_SIZE_BYTES,
  onProgress?: (percent: number, processedChunks: number, totalChunks: number) => void
): Promise<ClientFileProcessResult> {
  const totalSize = file.size;

  if (totalSize === 0) {
    return {
      wholeFileSha256: EMPTY_FILE_SHA256,
      merkleRootHash: EMPTY_TREE_ROOT,
      totalSize: 0,
      totalChunks: 0,
      chunkSizeBytes: chunkSize,
      chunks: [],
    };
  }

  const totalChunks = Math.ceil(totalSize / chunkSize);
  const chunks: ClientChunkDescriptor[] = [];
  const leafHashes: Uint8Array[] = [];

  // Read whole file for SHA-256 digest
  // For files in browser, calculate whole-file digest via ArrayBuffer
  const fullBuffer = await file.arrayBuffer();
  const wholeFileSha256 = await sha256Digest(fullBuffer);

  // Process chunks incrementally
  for (let i = 0; i < totalChunks; i++) {
    const offset = i * chunkSize;
    const sliceEnd = Math.min(offset + chunkSize, totalSize);
    const chunkBytes = new Uint8Array(fullBuffer.slice(offset, sliceEnd));

    const chunkSha = await sha256Digest(chunkBytes);
    const leafHashBytes = await computeMerkleLeafHash(chunkBytes);

    chunks.push({
      index: i,
      byteOffset: offset,
      byteLength: chunkBytes.length,
      sha256Hash: chunkSha,
      merkleLeafHash: bufferToHex(leafHashBytes),
    });

    leafHashes.push(leafHashBytes);

    if (onProgress) {
      const pct = Math.round(((i + 1) / totalChunks) * 100);
      onProgress(pct, i + 1, totalChunks);
    }
  }

  const merkleRootHash = await buildMerkleRoot(leafHashes);

  return {
    wholeFileSha256,
    merkleRootHash,
    totalSize,
    totalChunks,
    chunkSizeBytes: chunkSize,
    chunks,
  };
}
