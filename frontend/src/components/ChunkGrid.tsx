import React, { useState } from 'react';
import type { ChunkInfo } from '../types';
import { formatBytes, truncateHash } from '../utils';

interface ChunkGridProps {
  chunks: ChunkInfo[];
  maxDisplay?: number;
  onSelectChunk?: (chunk: ChunkInfo) => void;
  onVerifyProof?: (chunk: ChunkInfo) => Promise<{ verified: boolean; message: string }>;
}

export const ChunkGrid: React.FC<ChunkGridProps> = ({
  chunks,
  maxDisplay = 256,
  onSelectChunk,
  onVerifyProof,
}) => {
  const [activeChunk, setActiveChunk] = useState<ChunkInfo | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [proofStatus, setProofStatus] = useState<{ verified: boolean; message: string } | null>(null);

  const displayChunks = chunks.slice(0, maxDisplay);
  const remainingCount = chunks.length - displayChunks.length;

  const verifiedCount = chunks.filter((c) => c.status === 'verified').length;
  const inFlightCount = chunks.filter((c) => c.status === 'in_flight').length;
  const missingCount = chunks.filter((c) => c.status === 'missing').length;
  const corruptCount = chunks.filter((c) => c.status === 'corrupt').length;

  const handleVerify = async (chunk: ChunkInfo) => {
    if (!onVerifyProof) return;
    setVerifying(true);
    setProofStatus(null);
    try {
      const res = await onVerifyProof(chunk);
      setProofStatus(res);
    } catch (err: any) {
      setProofStatus({ verified: false, message: err?.message || 'Verification failed.' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="chunk-grid-container">
      <div className="chunk-grid-summary">
        <div className="chunk-legend">
          <div className="legend-item">
            <span className="chunk-block verified" />
            <span>Verified ({verifiedCount})</span>
          </div>
          <div className="legend-item">
            <span className="chunk-block in-flight" />
            <span>In-Flight ({inFlightCount})</span>
          </div>
          <div className="legend-item">
            <span className="chunk-block missing" />
            <span>Missing ({missingCount})</span>
          </div>
          {corruptCount > 0 && (
            <div className="legend-item">
              <span className="chunk-block corrupt" />
              <span>Corrupted/Retried ({corruptCount})</span>
            </div>
          )}
        </div>
        <span className="chunk-count-badge">
          {chunks.length} Total Chunks ({formatBytes(chunks.reduce((acc, c) => acc + c.sizeBytes, 0))})
        </span>
      </div>

      <div className="chunk-matrix" role="grid" aria-label="Chunk Bitfield Matrix">
        {displayChunks.map((chunk) => (
          <button
            key={chunk.index}
            type="button"
            className={`chunk-cell ${chunk.status} ${
              activeChunk?.index === chunk.index ? 'selected' : ''
            }`}
            onClick={() => {
              setActiveChunk(chunk);
              setProofStatus(null);
              if (onSelectChunk) onSelectChunk(chunk);
            }}
            onMouseEnter={() => {
              setActiveChunk(chunk);
            }}
            title={`Chunk #${chunk.index} (${chunk.status})`}
            aria-label={`Chunk ${chunk.index}: ${chunk.status}`}
          />
        ))}
      </div>

      {remainingCount > 0 && (
        <div className="chunk-overflow-note">
          + {remainingCount} additional chunks in file stream (showing first {maxDisplay})
        </div>
      )}

      {activeChunk && (
        <div className="chunk-inspector-card">
          <div className="inspector-row">
            <span className="inspector-label">Selected Chunk:</span>
            <span className="inspector-value">#{activeChunk.index}</span>
            <span className={`status-pill ${activeChunk.status}`}>
              {activeChunk.status.replace('_', ' ').toUpperCase()}
            </span>
            {activeChunk.isSimulatedVerification ? (
              <span className="hash-tag-simulated">Simulated Mock Chunk</span>
            ) : (
              <span className="hash-tag-verified">Cryptographically Verified</span>
            )}
          </div>
          <div className="inspector-grid">
            <div>
              <span className="inspector-sub">Chunk Size:</span>{' '}
              <span>{formatBytes(activeChunk.sizeBytes)}</span>
            </div>
            <div>
              <span className="inspector-sub">
                {activeChunk.isSimulatedVerification ? 'Per-Chunk SHA-256 (Simulated):' : 'Per-Chunk SHA-256 (Cryptographic):'}
              </span>{' '}
              <code title={activeChunk.chunkSha256 || activeChunk.hash}>
                {truncateHash(activeChunk.chunkSha256 || activeChunk.hash, 10, 8)}
              </code>
            </div>
            {activeChunk.merkleLeafHash && (
              <div>
                <span className="inspector-sub">Merkle Leaf SHA256(0x00 || chunk):</span>{' '}
                <code title={activeChunk.merkleLeafHash}>
                  {truncateHash(activeChunk.merkleLeafHash, 10, 8)}
                </code>
              </div>
            )}
            <div>
              <span className="inspector-sub">Possessing Swarm Peers:</span>{' '}
              <span>{activeChunk.seederCount} seeders</span>
            </div>
            {activeChunk.lastSourcePeer && (
              <div>
                <span className="inspector-sub">Source Peer:</span>{' '}
                <span>{activeChunk.lastSourcePeer}</span>
              </div>
            )}
          </div>

          {onVerifyProof && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleVerify(activeChunk)}
                disabled={verifying}
              >
                {verifying ? 'Checking Inclusion Proof...' : 'Verify Merkle Inclusion Proof'}
              </button>
              {proofStatus && (
                <span className={proofStatus.verified ? 'hash-tag-verified' : 'hash-tag-failed'}>
                  {proofStatus.verified ? '✓ ' : '✗ '} {proofStatus.message}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

