import React from 'react';
import type {
  ConnectionState,
  HealthStatus,
  ScreenId,
  P2PFile,
  TransferSession,
  PeerNode,
  ActivityLogEntry,
} from '../types';
import { MetricCard } from '../components/MetricCard';
import { InitStatusCard } from '../components/InitStatusCard';
import {
  ActivityIcon,
  FolderIcon,
  NetworkIcon,
  UploadIcon,
  TopologyIcon,
  CpuIcon,
} from '../components/icons/Icons';
import { formatBytes, formatSpeed, formatTimestamp } from '../utils';

interface OverviewDashboardProps {
  files: P2PFile[];
  transfers: TransferSession[];
  peers: PeerNode[];
  logs: ActivityLogEntry[];
  connectionState: ConnectionState;
  healthData: HealthStatus | null;
  errorMessage: string | null;
  apiUrl: string;
  onRefreshHealth: () => void;
  onNavigate: (screen: ScreenId, params?: { fileId?: string; transferId?: string }) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  files,
  transfers,
  peers,
  logs,
  connectionState,
  healthData,
  errorMessage,
  apiUrl,
  onRefreshHealth,
  onNavigate,
}) => {
  const activeTransfers = transfers.filter((t) => t.status === 'active');
  const connectedPeers = peers.filter((p) => p.status === 'connected');
  const totalThroughput = activeTransfers.reduce((acc, t) => acc + t.downloadSpeedBps, 0);

  return (
    <div className="page-container overview-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Simulated Network Telemetry:</strong> All swarm throughput, peer latency, and chunk
          bitfields on this dashboard are client-side simulated according to Phase 2 architecture formulas.
          No live WebRTC data channels or cloud credentials are active.
        </div>
      </div>

      {/* Top Metrics Row */}
      <section className="metrics-grid" aria-label="Key Performance Indicators">
        <MetricCard
          label="Swarm Offload Ratio"
          value="78.4%"
          subValue="21.6% Origin Fallback"
          trend={{ text: "+4.2% vs baseline", positive: true }}
          icon={<CpuIcon size={20} />}
          badge="High Efficiency"
        />
        <MetricCard
          label="Aggregate Swarm Speed"
          value={formatSpeed(totalThroughput)}
          subValue={`${activeTransfers.length} Active Stream${activeTransfers.length === 1 ? '' : 's'}`}
          trend={{ text: "+18.5 MB/s P2P", positive: true }}
          icon={<ActivityIcon size={20} />}
        />
        <MetricCard
          label="Connected Edge Peers"
          value={`${connectedPeers.length} / ${peers.length}`}
          subValue="6 Geographic Regions"
          trend={{ text: "87.5% NAT Direct", positive: true }}
          icon={<NetworkIcon size={20} />}
        />
        <MetricCard
          label="Distributed Catalog"
          value={files.length}
          subValue={formatBytes(files.reduce((acc, f) => acc + f.sizeBytes, 0))}
          trend={{ text: "420 Chunks / 1 MiB avg", neutral: true }}
          icon={<FolderIcon size={20} />}
        />
      </section>

      {/* Quick Action Bar */}
      <section className="quick-actions-bar" aria-label="Quick Actions">
        <div className="actions-title">Edge Operations:</div>
        <div className="actions-buttons">
          <button
            type="button"
            className="action-pill-btn primary"
            onClick={() => onNavigate('upload')}
          >
            <UploadIcon size={16} />
            <span>Stage File for Chunking</span>
          </button>
          <button
            type="button"
            className="action-pill-btn"
            onClick={() => onNavigate('transfers')}
          >
            <ActivityIcon size={16} />
            <span>Monitor Transfers ({activeTransfers.length})</span>
          </button>
          <button
            type="button"
            className="action-pill-btn"
            onClick={() => onNavigate('topology')}
          >
            <TopologyIcon size={16} />
            <span>Inspect Swarm Topology</span>
          </button>
          <button
            type="button"
            className="action-pill-btn"
            onClick={() => onNavigate('adaptive-engine')}
          >
            <CpuIcon size={16} />
            <span>Adaptive Scheduler Weights</span>
          </button>
        </div>
      </section>

      {/* Two Column Grid: Active Transfers & Swarm Status */}
      <div className="dashboard-two-col">
        {/* Left Column: Active Transfers */}
        <section className="dashboard-panel" aria-labelledby="active-transfers-heading">
          <div className="panel-header">
            <div>
              <h2 id="active-transfers-heading" className="panel-title">Active Transfer Streams</h2>
              <p className="panel-subtitle">Real-time bitfield chunk pipelining across connected peers</p>
            </div>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => onNavigate('transfers')}
            >
              View All Transfers →
            </button>
          </div>

          <div className="transfer-cards-list">
            {transfers.slice(0, 3).map((tx) => (
              <div key={tx.id} className="transfer-mini-card">
                <div className="tx-card-top">
                  <div className="tx-file-name">
                    <span className="file-icon">📄</span>
                    <strong>{tx.fileName}</strong>
                  </div>
                  <span className={`status-pill ${tx.status}`}>
                    {tx.status.toUpperCase()}
                  </span>
                </div>

                <div className="tx-progress-bar-bg">
                  <div
                    className="tx-progress-bar-fill"
                    style={{ width: `${tx.progressPercent}%` }}
                  />
                </div>

                <div className="tx-card-metrics">
                  <span>{tx.progressPercent}% ({tx.chunksCompleted}/{tx.totalChunks} Chunks)</span>
                  <span>{formatSpeed(tx.downloadSpeedBps)}</span>
                  <span>ETA: {tx.etaSeconds > 0 ? `${tx.etaSeconds}s` : 'Done'}</span>
                  <button
                    type="button"
                    className="inspect-tx-btn"
                    onClick={() => onNavigate('transfer-details', { transferId: tx.id })}
                  >
                    Inspect Chunks →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Swarm Peers Preview */}
        <section className="dashboard-panel" aria-labelledby="swarm-peers-heading">
          <div className="panel-header">
            <div>
              <h2 id="swarm-peers-heading" className="panel-title">Active Edge Peers</h2>
              <p className="panel-subtitle">High-utility candidates evaluated by Adaptive Scheduler</p>
            </div>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => onNavigate('peers')}
            >
              View All Peers ({peers.length}) →
            </button>
          </div>

          <div className="peers-table-compact-container">
            <table className="compact-data-table">
              <thead>
                <tr>
                  <th>Peer Node</th>
                  <th>Region</th>
                  <th>RTT</th>
                  <th>Throughput</th>
                  <th>Utility Score</th>
                </tr>
              </thead>
              <tbody>
                {peers.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="peer-id-cell">
                        <span className={`peer-status-dot ${p.status}`} />
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td>{p.region}</td>
                    <td>{p.latencyMs.toFixed(1)} ms</td>
                    <td>{formatSpeed(p.throughputBps)}</td>
                    <td>
                      <div className="score-cell">
                        <span className="score-val">{p.compositeScore.toFixed(3)}</span>
                        <div className="mini-score-bar">
                          <div
                            className="mini-score-fill"
                            style={{ width: `${p.compositeScore * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Activity Feed and Environment Readiness */}
      <div className="dashboard-two-col">
        {/* Recent Activity Log */}
        <section className="dashboard-panel" aria-labelledby="recent-activity-heading">
          <div className="panel-header">
            <div>
              <h2 id="recent-activity-heading" className="panel-title">Recent Network Events</h2>
              <p className="panel-subtitle">Simulated audit telemetry for chunk verification and ICE candidates</p>
            </div>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => onNavigate('activity-logs')}
            >
              Full Event Audit →
            </button>
          </div>

          <ul className="activity-mini-list">
            {logs.slice(0, 4).map((log) => (
              <li key={log.id} className="activity-mini-item">
                <span className={`log-badge ${log.severity.toLowerCase()}`}>
                  {log.severity}
                </span>
                <div className="log-mini-content">
                  <div className="log-mini-title">
                    <span className="log-component">[{log.component}]</span>{' '}
                    <strong>{log.event}</strong>
                    <span className="log-time">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  <p className="log-mini-details">{log.details}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Phase 1 Backend Tier Readiness Box */}
        <section className="dashboard-panel readiness-panel" aria-labelledby="readiness-panel-heading">
          <InitStatusCard
            connectionState={connectionState}
            healthData={healthData}
            errorMessage={errorMessage}
            apiUrl={apiUrl}
            onRefresh={onRefreshHealth}
          />
        </section>
      </div>
    </div>
  );
};
