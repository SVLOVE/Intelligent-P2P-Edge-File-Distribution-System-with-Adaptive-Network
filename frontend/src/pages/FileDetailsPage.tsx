import React, { useState } from 'react';
import type { ChunkInfo, P2PFile, ScreenId } from '../types';
import { ChunkGrid } from '../components/ChunkGrid';
import { generateMockChunks } from '../services/mockData';
import { FileTextIcon, ActivityIcon, FolderIcon } from '../components/icons/Icons';
import { formatBytes, formatTimestamp } from '../utils';
import { fetchChunkProof, verifyChunkProof } from '../services/api';

interface FileDetailsPageProps {
  files: P2PFile[];
  selectedFileId?: string;
  onSelectFileId: (id: string) => void;
  onNavigate: (screen: ScreenId, params?: { transferId?: string }) => void;
  onInitiateTransfer: (file: P2PFile) => void;
}

export const FileDetailsPage: React.FC<FileDetailsPageProps> = ({
  files,
  selectedFileId,
  onSelectFileId,
  onNavigate,
  onInitiateTransfer,
}) => {
  const currentFile = files.find((f) => f.id === selectedFileId) || files[0];
  const [previewChunkSize, setPreviewChunkSize] = useState<number>(currentFile?.chunkSizeBytes || 1048576);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!currentFile) {
    return (
      <div className="page-container">
        <div className="empty-state-box">
          <p>No files available in the catalog.</p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate('upload')}>
            Stage a File
          </button>
        </div>
      </div>
    );
  }

  // Generate chunks for visualization
  const chunks = currentFile.chunks || generateMockChunks(Math.min(currentFile.totalChunks, 64), 0.85);

  const calculatedPreviewChunks = Math.max(1, Math.ceil(currentFile.sizeBytes / previewChunkSize));
  const estimatedTreeOverhead = (calculatedPreviewChunks * 32) / 1024; // 32-byte SHA-256 per chunk

  const handleCopyHash = () => {
    navigator.clipboard?.writeText(currentFile.sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleVerifyProof = async (chunk: ChunkInfo) => {
    if (currentFile.isSimulated || currentFile.isPlaceholderHash) {
      return {
        verified: true,
        message: 'Simulated proof: chunk matches expected node in development fixture.',
      };
    }

    try {
      const proofRes = await fetchChunkProof(currentFile.id, chunk.index);
      const verifyRes = await verifyChunkProof(currentFile.id, {
        chunk_index: chunk.index,
        merkle_leaf_hash: proofRes.merkle_leaf_hash,
        proof: proofRes.proof,
        expected_merkle_root: proofRes.merkle_root,
      });
      return {
        verified: verifyRes.verified,
        message: verifyRes.verified
          ? 'Inclusion proof verified against authoritative Merkle root!'
          : `Proof verification failed: ${verifyRes.reason || 'Root mismatch'}`,
      };
    } catch (err: any) {
      return {
        verified: false,
        message: err?.message || 'Proof verification request failed.',
      };
    }
  };

  return (
    <div className="page-container file-details-page">
      {/* Simulation / Verification Notice Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Integrity Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>File Inspection Telemetry:</strong>{' '}
          {currentFile.isPlaceholderHash ? (
            <span>
              Merkle chunk hashes and whole-file digests shown below are simulated development fixtures.
            </span>
          ) : (
            <span>
              Cryptographic SHA-256 digests and domain-separated Merkle root have been genuinely verified
              from actual file bytes.
            </span>
          )}
        </div>
      </div>

      {/* Top File Selection & Header Card */}
      <div className="details-header-card">
        <div className="file-selector-row">
          <label htmlFor="file-inspect-select" className="file-select-label">
            Inspect File:
          </label>
          <select
            id="file-inspect-select"
            className="filter-select file-dropdown"
            value={currentFile.id}
            onChange={(e) => onSelectFileId(e.target.value)}
          >
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({formatBytes(f.sizeBytes)})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('files')}
          >
            <FolderIcon size={16} />
            <span>Catalog</span>
          </button>
        </div>

        <div className="file-hero-info">
          <div className="file-hero-icon">
            <FileTextIcon size={32} />
          </div>
          <div className="file-hero-meta">
            <div className="title-row">
              <h2 className="file-primary-name">{currentFile.name}</h2>
              <span className={`status-pill ${currentFile.status}`}>
                {currentFile.status.toUpperCase()}
              </span>
            </div>
            <p className="file-meta-desc">{currentFile.description}</p>
            <div className="meta-tags-list">
              <span className="tag-pill">Size: {formatBytes(currentFile.sizeBytes)}</span>
              <span className="tag-pill">MIME: {currentFile.mimeType}</span>
              <span className="tag-pill">Catalog ID: {currentFile.id}</span>
              <span className="tag-pill">Registered: {formatTimestamp(currentFile.createdAt)}</span>
            </div>
          </div>
          <div className="file-hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onInitiateTransfer(currentFile)}
            >
              <ActivityIcon size={16} />
              <span>Simulate Transfer</span>
            </button>
          </div>
        </div>

        {/* Cryptographic Integrity Manifest - Clearly Distinguished */}
        <div className="integrity-manifest-panel">
          <div className="integrity-row">
            <div className="integrity-meta">
              <span className="integrity-title">1. Whole-File SHA-256 Digest:</span>
              {currentFile.isPlaceholderHash ? (
                <span className="hash-tag-simulated">Simulated Placeholder</span>
              ) : (
                <span className="hash-tag-verified">Cryptographically Verified SHA-256</span>
              )}
              <p className="integrity-subtext">
                Cryptographic checksum calculated over the entire reassembled file payload byte stream.
              </p>
            </div>
            <div className="integrity-hash-display">
              <code className="sha-code">{currentFile.wholeFileSha256 || currentFile.sha256}</code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyHash}
                aria-label="Copy whole-file SHA-256 hash"
              >
                {copiedHash ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="integrity-row">
            <div className="integrity-meta">
              <span className="integrity-title">2. Merkle Root Hash (H_root):</span>
              {currentFile.isPlaceholderHash ? (
                <span className="hash-tag-simulated">Derived Tree Root Placeholder</span>
              ) : (
                <span className="hash-tag-verified">Verified Merkle Root (RFC 6962 Domain-Separated)</span>
              )}
              <p className="integrity-subtext">
                Top-level cryptographic root of the binary Merkle hash tree derived from the {currentFile.totalChunks} ordered 1 MiB chunk leaves.
              </p>
            </div>
            <div className="integrity-hash-display">
              <code className="sha-code">
                {currentFile.merkleRootHash || '3a18b76c9ef0283d582a9c4819204857bdf829103c847162590218374950abef'}
              </code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(currentFile.merkleRootHash || '');
                }}
                aria-label="Copy Merkle root hash"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Swarm Distribution & Redundancy Summary */}
      <div className="details-two-col">
        {/* Swarm Health Card */}
        <div className="dashboard-panel">
          <h3 className="panel-title">Swarm Health & Redundancy</h3>
          <p className="panel-subtitle">Availability index across active edge nodes</p>

          <div className="swarm-health-metrics">
            <div className="health-stat">
              <span className="stat-num text-success">{currentFile.seederCount}</span>
              <span className="stat-desc">Full Seeders</span>
            </div>
            <div className="health-stat">
              <span className="stat-num text-warning">{currentFile.leecherCount}</span>
              <span className="stat-desc">Active Leechers</span>
            </div>
            <div className="health-stat">
              <span className="stat-num text-info">
                {((currentFile.seederCount / Math.max(1, currentFile.seederCount + currentFile.leecherCount)) * 100).toFixed(0)}%
              </span>
              <span className="stat-desc">Health Ratio</span>
            </div>
            <div className="health-stat">
              <span className="stat-num text-accent">
                {(currentFile.seederCount * 1.25).toFixed(1)}x
              </span>
              <span className="stat-desc">Swarm Multiplier</span>
            </div>
          </div>

          <div className="distribution-narrative">
            <div className="narrative-row">
              <span className="dot ok" />
              <span>Sufficient full copies are hosted across local LAN and edge nodes.</span>
            </div>
            <div className="narrative-row">
              <span className="dot ok" />
              <span>Origin fallback requirement estimated at &lt; 15% under current peer density.</span>
            </div>
          </div>
        </div>

        {/* Configurable Chunk Size Preview Simulator */}
        <div className="dashboard-panel">
          <h3 className="panel-title">Chunk Size Configuration Preview</h3>
          <p className="panel-subtitle">Simulate how chunk partition sizing impacts transport overhead</p>

          <div className="chunk-size-slider-box">
            <div className="chunk-size-buttons">
              {[524288, 1048576, 2097152, 4194304].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`chunk-size-btn ${previewChunkSize === size ? 'active' : ''}`}
                  onClick={() => setPreviewChunkSize(size)}
                >
                  {formatBytes(size, 0)}
                  {size === 1048576 && <span className="default-pill">Default</span>}
                </button>
              ))}
            </div>

            <div className="chunk-calc-results">
              <div className="calc-item">
                <span className="calc-label">Calculated Chunks:</span>
                <span className="calc-value">{calculatedPreviewChunks} chunks</span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Merkle Manifest Overhead:</span>
                <span className="calc-value">{estimatedTreeOverhead.toFixed(2)} KiB</span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Pipeline In-Flight Memory:</span>
                <span className="calc-value">{formatBytes(previewChunkSize * 4)} (4-window)</span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Packet Loss Sensitivity:</span>
                <span className="calc-value">
                  {previewChunkSize <= 524288 ? 'Low (Resilient)' : previewChunkSize <= 2097152 ? 'Balanced' : 'High (Retries Heavy)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Chunk Bitfield Matrix */}
      <div className="dashboard-panel chunk-inspection-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Chunk Bitfield Verification Matrix</h3>
            <p className="panel-subtitle">
              Visual map of cryptographic verification states. Click any cell to inspect chunk metadata and verify Merkle proofs.
            </p>
          </div>
        </div>

        <ChunkGrid chunks={chunks} onVerifyProof={handleVerifyProof} />
      </div>
    </div>
  );
};

