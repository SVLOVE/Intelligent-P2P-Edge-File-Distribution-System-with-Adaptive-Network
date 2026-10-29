import React, { useState } from 'react';
import type { TransferSession, ScreenId, TransferStatus } from '../types';
import { MetricCard } from '../components/MetricCard';
import { ActivityIcon, FileTextIcon, FolderIcon } from '../components/icons/Icons';
import { formatBytes, formatSpeed, formatDuration, formatPercent } from '../utils';

interface TransferMonitorPageProps {
  transfers: TransferSession[];
  onTogglePause: (transferId: string) => void;
  onNavigate: (screen: ScreenId, params?: { transferId?: string; fileId?: string }) => void;
}

export const TransferMonitorPage: React.FC<TransferMonitorPageProps> = ({
  transfers,
  onTogglePause,
  onNavigate,
}) => {
  const [filterStatus, setFilterStatus] = useState<TransferStatus | 'all'>('all');

  const activeTransfers = transfers.filter((t) => t.status === 'active');
  const totalDownSpeed = activeTransfers.reduce((acc, t) => acc + t.downloadSpeedBps, 0);
  const totalUpSpeed = activeTransfers.reduce((acc, t) => acc + t.uploadSpeedBps, 0);
  const avgP2pRatio =
    transfers.length > 0
      ? transfers.reduce((acc, t) => acc + t.p2pRatio, 0) / transfers.length
      : 0;

  const filteredTransfers = transfers.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="page-container transfer-monitor-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Transfer Simulation Monitor:</strong> Transfer speeds, chunk bitfields, and ETA calculations
          are simulated in-browser to demonstrate adaptive multi-peer chunk scheduling and congestion control.
        </div>
      </div>

      {/* Aggregate Telemetry Cards */}
      <section className="metrics-grid" aria-label="Transfer Metrics">
        <MetricCard
          label="Aggregate Download Rate"
          value={formatSpeed(totalDownSpeed)}
          subValue="Multi-Peer P2P Ingest"
          icon={<ActivityIcon size={20} />}
          trend={{ text: "+14.2 MB/s", positive: true }}
        />
        <MetricCard
          label="Aggregate Upload Rate"
          value={formatSpeed(totalUpSpeed)}
          subValue="Swarm Seeding Egress"
          icon={<ActivityIcon size={20} />}
          trend={{ text: "Active seeding", positive: true }}
        />
        <MetricCard
          label="P2P Swarm Offload"
          value={formatPercent(avgP2pRatio)}
          subValue="Origin bandwidth bypassed"
          icon={<ActivityIcon size={20} />}
          badge="Adaptive"
        />
        <MetricCard
          label="Active Streams"
          value={activeTransfers.length}
          subValue={`${transfers.length} Total Sessions`}
          icon={<ActivityIcon size={20} />}
          badge="Concurrent"
        />
      </section>

      {/* Filter Tabs & Quick Action */}
      <div className="transfers-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Transfer status filter">
          {(['all', 'active', 'completed', 'paused'] as const).map((status) => {
            const count =
              status === 'all'
                ? transfers.length
                : transfers.filter((t) => t.status === status).length;
            return (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={filterStatus === status}
                className={`filter-tab-btn ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status.toUpperCase()} ({count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onNavigate('files')}
        >
          <FolderIcon size={16} />
          <span>Stage Transfer from Catalog</span>
        </button>
      </div>

      {/* Transfers Cards List */}
      <div className="transfers-list">
        {filteredTransfers.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-icon">⚡</span>
            <p className="empty-title">No transfers match current filter</p>
            <p className="empty-desc">
              Select &quot;All&quot; or start a new simulated download from the File Library catalog.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFilterStatus('all')}
            >
              Reset Filter
            </button>
          </div>
        ) : (
          filteredTransfers.map((tx) => (
            <div key={tx.id} className="transfer-card">
              <div className="tx-card-header">
                <div className="tx-title-group">
                  <span className="tx-file-icon">📦</span>
                  <div>
                    <h3 className="tx-file-name">{tx.fileName}</h3>
                    <div className="tx-meta-row">
                      <span className="tx-id-tag">ID: {tx.id}</span>
                      <span className="tx-size-tag">Size: {formatBytes(tx.fileSizeBytes)}</span>
                      <span className={`mode-badge ${tx.mode}`}>
                        {tx.mode === 'p2p_direct'
                          ? 'Direct P2P'
                          : tx.mode === 'hybrid_origin'
                          ? 'Hybrid P2P + Origin'
                          : 'TURN Relay'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tx-header-actions">
                  <span className={`status-pill ${tx.status}`}>
                    {tx.status.toUpperCase()}
                  </span>
                  {tx.status !== 'completed' && (
                    <button
                      type="button"
                      className="btn-pause-toggle"
                      onClick={() => onTogglePause(tx.id)}
                    >
                      {tx.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigate('transfer-details', { transferId: tx.id })}
                  >
                    <FileTextIcon size={14} />
                    <span>Chunk Heatmap</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="tx-progress-section">
                <div className="progress-labels-row">
                  <span className="progress-percent-text">
                    <strong>{tx.progressPercent}%</strong> completed
                  </span>
                  <span className="chunks-completed-text">
                    {tx.chunksCompleted} / {tx.totalChunks} Chunks Verified
                  </span>
                </div>
                <div className="tx-bar-track">
                  <div
                    className={`tx-bar-fill ${tx.status}`}
                    style={{ width: `${tx.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Transfer Metrics Footer */}
              <div className="tx-card-footer">
                <div className="tx-footer-metric">
                  <span className="metric-label">Download Speed:</span>
                  <span className="metric-val text-success">
                    {formatSpeed(tx.downloadSpeedBps)}
                  </span>
                </div>
                <div className="tx-footer-metric">
                  <span className="metric-label">Upload Rate:</span>
                  <span className="metric-val text-info">
                    {formatSpeed(tx.uploadSpeedBps)}
                  </span>
                </div>
                <div className="tx-footer-metric">
                  <span className="metric-label">Est. Time Remaining:</span>
                  <span className="metric-val">
                    {tx.status === 'completed'
                      ? 'Finished'
                      : tx.status === 'paused'
                      ? 'Paused'
                      : formatDuration(tx.etaSeconds)}
                  </span>
                </div>
                <div className="tx-footer-metric">
                  <span className="metric-label">P2P Ratio:</span>
                  <span className="metric-val text-accent">
                    {formatPercent(tx.p2pRatio)}
                  </span>
                </div>
                <div className="tx-footer-metric">
                  <span className="metric-label">Connected Swarm:</span>
                  <span className="metric-val">{tx.connectedPeers} peers</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
