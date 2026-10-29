import React, { useState } from 'react';
import type { TransferSession, PeerNode, ScreenId } from '../types';
import { ChunkGrid } from '../components/ChunkGrid';
import { generateMockChunks } from '../services/mockData';
import { ActivityIcon, NetworkIcon } from '../components/icons/Icons';
import { formatBytes, formatSpeed, formatDuration, formatPercent } from '../utils';

interface TransferDetailsPageProps {
  transfers: TransferSession[];
  peers: PeerNode[];
  selectedTransferId?: string;
  onSelectTransferId: (id: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

export const TransferDetailsPage: React.FC<TransferDetailsPageProps> = ({
  transfers,
  peers,
  selectedTransferId,
  onSelectTransferId,
  onNavigate,
}) => {
  const currentTransfer =
    transfers.find((t) => t.id === selectedTransferId) || transfers[0];

  const [activeChunkSummary, setActiveChunkSummary] = useState<string | null>(null);

  if (!currentTransfer) {
    return (
      <div className="page-container">
        <div className="empty-state-box">
          <p>No active transfer sessions available to inspect.</p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate('transfers')}>
            View Transfer Monitor
          </button>
        </div>
      </div>
    );
  }

  // Generate chunks matching current transfer progress
  const chunkCount = Math.min(currentTransfer.totalChunks, 128);
  const chunks = generateMockChunks(chunkCount, currentTransfer.progressPercent / 100);

  // Contributing peers subset
  const contributingPeers = peers.slice(0, 5);

  return (
    <div className="page-container transfer-details-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Transfer Session Inspector:</strong> Chunk bitfield and per-peer transmission speeds
          reflect simulated WebRTC SCTP pipeline allocations governed by the Adaptive Scheduling Engine.
        </div>
      </div>

      {/* Session Header Card */}
      <div className="details-header-card">
        <div className="file-selector-row">
          <label htmlFor="tx-inspect-select" className="file-select-label">
            Inspect Session:
          </label>
          <select
            id="tx-inspect-select"
            className="filter-select file-dropdown"
            value={currentTransfer.id}
            onChange={(e) => onSelectTransferId(e.target.value)}
          >
            {transfers.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {tx.fileName} ({tx.progressPercent}% - {tx.id})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('transfers')}
          >
            <ActivityIcon size={16} />
            <span>All Transfers</span>
          </button>
        </div>

        <div className="file-hero-info">
          <div className="file-hero-icon">
            <ActivityIcon size={32} />
          </div>
          <div className="file-hero-meta">
            <div className="title-row">
              <h2 className="file-primary-name">{currentTransfer.fileName}</h2>
              <span className={`status-pill ${currentTransfer.status}`}>
                {currentTransfer.status.toUpperCase()}
              </span>
              <span className={`mode-badge ${currentTransfer.mode}`}>
                {currentTransfer.mode.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="meta-tags-list">
              <span className="tag-pill">Session ID: {currentTransfer.id}</span>
              <span className="tag-pill">Target Size: {formatBytes(currentTransfer.fileSizeBytes)}</span>
              <span className="tag-pill">Elapsed: {formatDuration(currentTransfer.elapsedSeconds)}</span>
              <span className="tag-pill">ETA: {currentTransfer.status === 'completed' ? 'Done' : formatDuration(currentTransfer.etaSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="tx-details-progress">
          <div className="progress-labels-row">
            <span>
              <strong>{currentTransfer.progressPercent}%</strong> verified
            </span>
            <span>
              {currentTransfer.chunksCompleted} of {currentTransfer.totalChunks} Chunks (1 MiB boundary)
            </span>
          </div>
          <div className="tx-bar-track">
            <div
              className={`tx-bar-fill ${currentTransfer.status}`}
              style={{ width: `${currentTransfer.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bitfield Matrix Section */}
      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Real-Time Chunk Bitfield Heatmap</h3>
            <p className="panel-subtitle">
              Visual bitfield state representing current WebRTC in-flight requests and verified pieces.
            </p>
          </div>
          {activeChunkSummary && (
            <span className="chunk-summary-pill">{activeChunkSummary}</span>
          )}
        </div>

        <ChunkGrid
          chunks={chunks}
          onSelectChunk={(c) =>
            setActiveChunkSummary(`Selected Chunk #${c.index} [${c.status}]`)
          }
        />
      </div>

      {/* Contributing Peers Table */}
      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Active Contributing Swarm Peers</h3>
            <p className="panel-subtitle">
              Dynamic transmission pipeline and throughput contribution per edge peer
            </p>
          </div>
          <button
            type="button"
            className="panel-link-btn"
            onClick={() => onNavigate('peers')}
          >
            Inspect Swarm Peers →
          </button>
        </div>

        <div className="table-responsive-wrapper">
          <table className="data-table" aria-label="Contributing Peers">
            <thead>
              <tr>
                <th>Peer Node</th>
                <th>Region</th>
                <th>NAT Type</th>
                <th>RTT Latency</th>
                <th>Stream Ingest Speed</th>
                <th>Pipeline Window</th>
                <th>Utility Rank</th>
              </tr>
            </thead>
            <tbody>
              {contributingPeers.map((p, idx) => (
                <tr key={p.id}>
                  <td>
                    <div className="peer-id-cell">
                      <NetworkIcon size={16} />
                      <div>
                        <strong>{p.name}</strong>
                        <div className="peer-sub-ip">{p.ipMasked}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.region}</td>
                  <td>
                    <span className="nat-pill">{p.natType}</span>
                  </td>
                  <td className="monospace-cell">{p.latencyMs.toFixed(1)} ms</td>
                  <td className="monospace-cell text-success">
                    {formatSpeed(p.throughputBps * (1 - idx * 0.15))}
                  </td>
                  <td>
                    <div className="pipeline-window-pill">
                      {p.maxPipelineWindow} / 4 Slots
                    </div>
                  </td>
                  <td>
                    <span className="score-pill">#{idx + 1} (Score: {p.compositeScore.toFixed(3)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Provenance Breakdown */}
      <div className="dashboard-panel">
        <h3 className="panel-title">Bandwidth Provenance Breakdown</h3>
        <p className="panel-subtitle">Distribution ratio: Edge P2P mesh vs Origin cloud fallback</p>

        <div className="provenance-grid">
          <div className="provenance-stat">
            <span className="prov-label">Edge Swarm (P2P Direct)</span>
            <span className="prov-val text-success">{formatPercent(currentTransfer.p2pRatio)}</span>
            <span className="prov-sub">
              {formatBytes(currentTransfer.fileSizeBytes * currentTransfer.p2pRatio * (currentTransfer.progressPercent / 100))} ingested via edge
            </span>
          </div>

          <div className="provenance-stat">
            <span className="prov-label">Origin Cloud Fallback</span>
            <span className="prov-val text-warning">{formatPercent(1 - currentTransfer.p2pRatio)}</span>
            <span className="prov-sub">
              {formatBytes(currentTransfer.fileSizeBytes * (1 - currentTransfer.p2pRatio) * (currentTransfer.progressPercent / 100))} fetched from cloud bucket
            </span>
          </div>

          <div className="provenance-stat">
            <span className="prov-label">Cloud Egress Cost Saved</span>
            <span className="prov-val text-accent">
              ${((currentTransfer.fileSizeBytes * currentTransfer.p2pRatio) / (1024 * 1024 * 1024) * 0.08).toFixed(3)}
            </span>
            <span className="prov-sub">Estimated at $0.08 / GiB cloud egress</span>
          </div>
        </div>
      </div>
    </div>
  );
};
