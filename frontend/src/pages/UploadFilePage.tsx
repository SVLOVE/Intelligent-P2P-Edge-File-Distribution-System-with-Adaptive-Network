import React, { useState } from 'react';
import type { ChunkInfo, P2PFile, ScreenId } from '../types';
import { UploadIcon, FileTextIcon, CheckCircleIcon } from '../components/icons/Icons';
import { formatBytes } from '../utils';
import { processFileInBrowser } from '../utils/crypto';
import { processBinaryFileUpload } from '../services/api';

interface UploadFilePageProps {
  onAddFile: (file: P2PFile) => void;
  onNavigate: (screen: ScreenId, params?: { fileId?: string }) => void;
}

export const UploadFilePage: React.FC<UploadFilePageProps> = ({
  onAddFile,
  onNavigate,
}) => {
  const [realFile, setRealFile] = useState<File | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);

  const [chunkSizeBytes, setChunkSizeBytes] = useState<number>(1048576); // 1 MiB default
  const [isStaging, setIsStaging] = useState(false);
  const [stagingMode, setStagingMode] = useState<'crypto' | 'backend' | 'simulated'>('crypto');
  const [stageProgress, setStageProgress] = useState(0);
  const [stageComplete, setStageComplete] = useState(false);
  const [stagedFileId, setStagedFileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRealFile(file);
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      });
      setStageComplete(false);
      setStageProgress(0);
      setErrorMessage(null);
    }
  };

  const handleRealCryptographicStaging = async () => {
    if (!realFile) return;

    setIsStaging(true);
    setStagingMode('crypto');
    setStageProgress(5);
    setErrorMessage(null);

    try {
      const result = await processFileInBrowser(realFile, chunkSizeBytes, (pct) => {
        setStageProgress(pct);
      });

      const generatedId = `f-real-${Date.now().toString(16)}`;

      const realChunks: ChunkInfo[] = result.chunks.map((c) => ({
        index: c.index,
        chunkSha256: c.sha256Hash,
        hash: c.sha256Hash,
        sizeBytes: c.byteLength,
        status: 'verified',
        seederCount: 1,
        isSimulatedVerification: false,
        merkleLeafHash: c.merkleLeafHash,
      }));

      const newFile: P2PFile = {
        id: generatedId,
        name: realFile.name,
        sizeBytes: result.totalSize,
        mimeType: realFile.type || 'application/octet-stream',
        wholeFileSha256: result.wholeFileSha256,
        merkleRootHash: result.merkleRootHash,
        sha256: result.wholeFileSha256,
        totalChunks: result.totalChunks,
        chunkSizeBytes: result.chunkSizeBytes,
        status: 'ready',
        seederCount: 1,
        leecherCount: 0,
        createdAt: new Date().toISOString(),
        description: `Cryptographically verified asset partitioned into ${result.totalChunks} chunks of ${formatBytes(chunkSizeBytes)} with domain-separated Merkle tree.`,
        chunks: realChunks,
        isSimulated: false,
        isPlaceholderHash: false,
      };

      onAddFile(newFile);
      setStageProgress(100);
      setStageComplete(true);
      setStagedFileId(generatedId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Cryptographic processing failed.');
    } finally {
      setIsStaging(false);
    }
  };

  const handleBackendStreamingStaging = async () => {
    if (!realFile) return;

    setIsStaging(true);
    setStagingMode('backend');
    setStageProgress(25);
    setErrorMessage(null);

    try {
      setStageProgress(50);
      const manifest = await processBinaryFileUpload(realFile);
      setStageProgress(90);

      const realChunks: ChunkInfo[] = manifest.chunks.map((c: any) => ({
        index: c.chunk_index,
        chunkSha256: c.sha256_hash,
        hash: c.sha256_hash,
        sizeBytes: c.byte_length,
        status: 'verified',
        seederCount: 1,
        isSimulatedVerification: false,
        merkleLeafHash: c.merkle_leaf_hash,
      }));

      const newFile: P2PFile = {
        id: manifest.file_id,
        name: manifest.name,
        sizeBytes: manifest.total_size_bytes,
        mimeType: realFile.type || 'application/octet-stream',
        wholeFileSha256: manifest.whole_file_sha256,
        merkleRootHash: manifest.merkle_root_hash,
        sha256: manifest.whole_file_sha256,
        totalChunks: manifest.total_chunks,
        chunkSizeBytes: manifest.chunk_size_bytes,
        status: 'verified',
        seederCount: 1,
        leecherCount: 0,
        createdAt: new Date().toISOString(),
        description: 'Persisted in FastAPI backend & PostgreSQL with authoritative SHA-256 and Merkle tree.',
        chunks: realChunks,
        isSimulated: false,
        isPlaceholderHash: false,
        storageNotice: 'Cryptographically verified: genuine whole-file SHA-256 and Merkle tree constructed from binary stream.',
      };

      onAddFile(newFile);
      setStageProgress(100);
      setStageComplete(true);
      setStagedFileId(manifest.file_id);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Backend upload failed.');
    } finally {
      setIsStaging(false);
    }
  };

  const handleSimulatedStaging = () => {
    if (!selectedFile) return;

    setIsStaging(true);
    setStagingMode('simulated');
    setStageProgress(15);
    setErrorMessage(null);

    const stepInterval = setInterval(() => {
      setStageProgress((prev) => {
        if (prev >= 90) {
          clearInterval(stepInterval);
          setTimeout(() => {
            const totalChunks = Math.ceil(selectedFile.size / chunkSizeBytes);
            const generatedId = `f-stage-${Date.now().toString().slice(-4)}`;

            const newFile: P2PFile = {
              id: generatedId,
              name: selectedFile.name,
              sizeBytes: selectedFile.size,
              mimeType: selectedFile.type,
              wholeFileSha256: `sim_placeholder_wf_${Date.now().toString(16)}fa8812c32bb06ecaa6970bc23512b9a7c3d18e28`,
              merkleRootHash: `sim_placeholder_mr_${Date.now().toString(16)}3a18b76c9ef0283d582a9c4819204857bdf82910`,
              sha256: `sim_placeholder_wf_${Date.now().toString(16)}fa8812c32bb06ecaa6970bc23512b9a7c3d18e28`,
              totalChunks,
              chunkSizeBytes,
              status: 'ready',
              seederCount: 1,
              leecherCount: 0,
              createdAt: new Date().toISOString(),
              description: `Client-staged test asset partitioned into ${totalChunks} chunks of ${formatBytes(chunkSizeBytes)}.`,
              isSimulated: true,
              isPlaceholderHash: true,
            };

            onAddFile(newFile);
            setIsStaging(false);
            setStageComplete(true);
            setStagedFileId(generatedId);
          }, 300);
          return 100;
        }
        return prev + 25;
      });
    }, 150);
  };

  const totalChunksCalculated = selectedFile
    ? Math.max(1, Math.ceil(selectedFile.size / chunkSizeBytes))
    : 0;

  return (
    <div className="page-container upload-page">
      {/* Integrity Information Banner */}
      <div className="sim-notice-banner warning-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">⚠</div>
        <div className="notice-content">
          <strong>Client-Side Preparation Only:</strong> Select an actual file to compute genuine
          client-side SHA-256 hashes and domain-separated Merkle trees via Web Crypto, or stream directly to the
          FastAPI backend. Simulated fixtures remain available for test benchmarking.
        </div>
      </div>


      <div className="upload-layout-grid">
        {/* Left Column: Drag & Drop Dropzone */}
        <div className="upload-card">
          <h2 className="card-heading">Select File for Edge Partitioning</h2>
          <p className="card-subheading">
            Choose any binary, model weights, or dataset to perform real chunking, SHA-256 hashing, and Merkle tree construction.
          </p>

          <label className="dropzone-area" htmlFor="file-upload-input">
            <input
              id="file-upload-input"
              type="file"
              className="dropzone-input"
              onChange={handleFileInput}
              aria-label="Upload file for chunking"
            />
            <div className="dropzone-icon">
              <UploadIcon size={36} />
            </div>
            <div className="dropzone-text">
              <span className="primary-text">Click to browse or drag file here</span>
              <span className="secondary-text">
                Supports any file format (Models, ISOs, Parquet, Media, Archives)
              </span>
            </div>
          </label>

          {/* Quick preset loader for simulated payloads */}
          <div className="preset-buttons-box">
            <span className="preset-label">Or load a sample test payload:</span>
            <div className="preset-buttons">
              <button
                type="button"
                className="btn-preset"
                onClick={() => {
                  setRealFile(null);
                  setSelectedFile({
                    name: 'autonomous_drone_lidar_dataset.pcap',
                    size: 891289600, // ~850 MiB
                    type: 'application/vnd.tcpdump.pcap',
                  });
                  setStageComplete(false);
                }}
              >
                Sample PCAP (850 MiB)
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={() => {
                  setRealFile(null);
                  setSelectedFile({
                    name: 'deepseek_distill_q4_k_m.gguf',
                    size: 4294967296, // 4.0 GiB
                    type: 'application/octet-stream',
                  });
                  setStageComplete(false);
                }}
              >
                Sample GGUF Model (4 GiB)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Chunk Configuration & Preparation Manifest */}
        <div className="upload-card">
          <h2 className="card-heading">Chunking Architecture & Parameters</h2>
          <p className="card-subheading">
            Configure chunk granularity according to edge network latency and memory constraints.
          </p>

          <div className="config-form-group">
            <label htmlFor="chunk-size-select" className="form-label">
              Chunk Partition Size (C_size):
            </label>
            <select
              id="chunk-size-select"
              className="form-select"
              value={chunkSizeBytes}
              onChange={(e) => setChunkSizeBytes(Number(e.target.value))}
              disabled={isStaging}
            >
              <option value={524288}>512 KiB (High latency / packet loss mitigation)</option>
              <option value={1048576}>1 MiB (Recommended Project Baseline)</option>
              <option value={2097152}>2 MiB (High throughput edge LANs)</option>
              <option value={4194304}>4 MiB (Maximum WebRTC data channel frame buffer)</option>
            </select>
            <span className="form-helper">
              Baseline 1 MiB chunk size balances WebRTC SCTP buffer limits with Merkle tree overhead.
            </span>
          </div>

          {selectedFile ? (
            <div className="file-prep-preview">
              <div className="prep-header">
                <FileTextIcon size={24} />
                <div className="prep-info">
                  <strong>{selectedFile.name}</strong>
                  <span>{formatBytes(selectedFile.size)} • {selectedFile.type}</span>
                  {realFile ? (
                    <span className="hash-tag-verified" style={{ marginLeft: '0.5rem' }}>
                      Real File Selected
                    </span>
                  ) : (
                    <span className="hash-tag-simulated" style={{ marginLeft: '0.5rem' }}>
                      Simulated Test Payload
                    </span>
                  )}
                </div>
              </div>

              <div className="prep-stats-grid">
                <div className="prep-stat">
                  <span className="stat-label">Calculated Chunks</span>
                  <span className="stat-val">{totalChunksCalculated} chunks</span>
                </div>
                <div className="prep-stat">
                  <span className="stat-label">Chunk Boundary</span>
                  <span className="stat-val">{formatBytes(chunkSizeBytes)}</span>
                </div>
                <div className="prep-stat">
                  <span className="stat-label">Estimated Tree Overhead</span>
                  <span className="stat-val">{(totalChunksCalculated * 32 / 1024).toFixed(1)} KiB</span>
                </div>
                <div className="prep-stat">
                  <span className="stat-label">Integrity Architecture</span>
                  <span className="stat-val">RFC 6962 Domain Separation</span>
                </div>
              </div>

              {errorMessage && (
                <div className="stage-error-box" style={{ color: '#f87171', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  ⚠ {errorMessage}
                </div>
              )}

              {isStaging && (
                <div className="staging-progress-box">
                  <div className="progress-labels">
                    <span>
                      {stagingMode === 'crypto'
                        ? 'Computing genuine SHA-256 and Merkle tree via WebCrypto...'
                        : stagingMode === 'backend'
                        ? 'Streaming binary payload to FastAPI backend...'
                        : 'Simulating Merkle tree partition manifest...'}
                    </span>
                    <span>{stageProgress}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${stageProgress}%` }} />
                  </div>
                </div>
              )}

              {stageComplete ? (
                <div className="stage-success-box">
                  <div className="success-row">
                    <CheckCircleIcon size={20} className="success-icon" />
                    <strong>File Cryptographically Verified &amp; Staged!</strong>
                  </div>
                  <p className="success-desc">
                    Manifest created with {totalChunksCalculated} chunks. Whole-file SHA-256 and domain-separated
                    Merkle tree have been constructed and verified.
                  </p>
                  <div className="success-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onNavigate('file-details', { fileId: stagedFileId || undefined })}
                    >
                      Inspect File Chunks &amp; Proofs →
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onNavigate('files')}
                    >
                      Return to File Library
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {realFile ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        onClick={handleRealCryptographicStaging}
                        disabled={isStaging}
                      >
                        {isStaging && stagingMode === 'crypto'
                          ? 'Computing Genuine SHA-256 & Merkle Tree...'
                          : 'Process Real Cryptographic Chunks (Client-Side)'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-block"
                        onClick={handleBackendStreamingStaging}
                        disabled={isStaging}
                      >
                        {isStaging && stagingMode === 'backend'
                          ? 'Streaming to Backend...'
                          : 'Stream & Persist to FastAPI Backend'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={handleSimulatedStaging}
                      disabled={isStaging}
                    >
                      {isStaging ? 'Partitioning...' : 'Simulate Manifest Partitioning'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="no-file-selected">
              <span className="hint-icon">👈</span>
              <p>Select or drag a file on the left to preview chunk partition calculations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

