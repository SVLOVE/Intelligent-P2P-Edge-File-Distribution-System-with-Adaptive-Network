import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILE_SHA256,
  EMPTY_TREE_ROOT,
  bufferToHex,
  hexToBytes,
  sha256Digest,
  computeMerkleLeafHash,
  buildMerkleRoot,
  processFileInBrowser,
} from '../src/utils/crypto';

describe('Phase 4.3 WebCrypto Client Utilities', () => {
  it('converts between buffers and lowercase hex strings correctly', () => {
    const raw = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);
    const hex = bufferToHex(raw);
    expect(hex).toBe('deadbeef0102');
    const back = hexToBytes(hex);
    expect(Array.from(back)).toEqual(Array.from(raw));
  });

  it('produces standard SHA-256 digests for empty and ASCII inputs', async () => {
    const emptyBuf = new Uint8Array(0);
    const emptySha = await sha256Digest(emptyBuf);
    expect(emptySha).toBe(EMPTY_FILE_SHA256);

    const textBuf = new TextEncoder().encode('hello world');
    const textSha = await sha256Digest(textBuf);
    expect(textSha).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('computes domain-separated Merkle leaf hash SHA256(0x00 || chunk)', async () => {
    const chunk = new TextEncoder().encode('test chunk');
    const leafBytes = await computeMerkleLeafHash(chunk);
    const leafHex = bufferToHex(leafBytes);

    // Verify it differs from ordinary SHA256(chunk)
    const ordinarySha = await sha256Digest(chunk);
    expect(leafHex).not.toBe(ordinarySha);
    expect(leafHex.length).toBe(64);
  });

  it('produces deterministic empty Merkle root SHA256(0x02)', async () => {
    const root = await buildMerkleRoot([]);
    expect(root).toBe(EMPTY_TREE_ROOT);
  });

  it('builds deterministic Merkle root with odd-node duplication', async () => {
    // 3 leaves: L0, L1, L2
    const leaves = await Promise.all([
      computeMerkleLeafHash(new TextEncoder().encode('leaf_0')),
      computeMerkleLeafHash(new TextEncoder().encode('leaf_1')),
      computeMerkleLeafHash(new TextEncoder().encode('leaf_2')),
    ]);

    const root1 = await buildMerkleRoot(leaves);
    const root2 = await buildMerkleRoot(leaves);
    expect(root1).toBe(root2);
    expect(root1.length).toBe(64);
  });

  it('processes browser File object incrementally into real chunks', async () => {
    const content = new Uint8Array(2500);
    for (let i = 0; i < 2500; i++) content[i] = i % 256;

    const file = new File([content], 'sample_dataset.bin', { type: 'application/octet-stream' });
    const result = await processFileInBrowser(file, 1024);

    expect(result.totalSize).toBe(2500);
    expect(result.totalChunks).toBe(3);
    expect(result.chunkSizeBytes).toBe(1024);
    expect(result.chunks.length).toBe(3);
    expect(result.chunks[0].byteLength).toBe(1024);
    expect(result.chunks[1].byteLength).toBe(1024);
    expect(result.chunks[2].byteLength).toBe(452); // Final partial chunk
    expect(result.wholeFileSha256.length).toBe(64);
    expect(result.merkleRootHash.length).toBe(64);
  });
});
