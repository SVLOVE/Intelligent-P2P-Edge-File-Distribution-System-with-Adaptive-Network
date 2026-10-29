import React, { useState } from 'react';
import type { ScreenId } from '../types';
import { MOCK_ANALYTICS } from '../services/mockData';
import { MetricCard } from '../components/MetricCard';
import { BarChartIcon, ActivityIcon, NetworkIcon } from '../components/icons/Icons';
import { formatBytes } from '../utils';

interface AnalyticsPageProps {
  onNavigate: (screen: ScreenId) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = () => {
  const analytics = MOCK_ANALYTICS;
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    analytics.timeSeriesData.length - 1
  );

  const selectedPoint =
    selectedPointIndex !== null ? analytics.timeSeriesData[selectedPointIndex] : null;

  return (
    <div className="page-container analytics-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Swarm Analytics Telemetry:</strong> Bandwidth offload curves, latency percentiles, and
          cryptographic verification statistics are simulated based on Phase 2 research benchmark profiles.
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <section className="metrics-grid" aria-label="High-Level Analytics">
        <MetricCard
          label="Total Bandwidth Offloaded"
          value={formatBytes(analytics.totalBandwidthSavedBytes)}
          subValue="Bypassed Cloud Origin"
          icon={<BarChartIcon size={20} />}
          trend={{ text: "78.4% P2P Swarm Ratio", positive: true }}
          badge="High Efficiency"
        />
        <MetricCard
          label="Average Swarm Throughput"
          value="32.5 MB/s"
          subValue="Across 38 Active Peers"
          icon={<ActivityIcon size={20} />}
          trend={{ text: "+4.8 MB/s vs baseline", positive: true }}
        />
        <MetricCard
          label="Chunk Integrity Verification"
          value={`${(analytics.chunkVerificationSuccessRate * 100).toFixed(2)}%`}
          subValue="48,920 Chunks Evaluated"
          icon={<NetworkIcon size={20} />}
          trend={{ text: "SHA-256 Validated", positive: true }}
        />
        <MetricCard
          label="Stalled Transfers Recovered"
          value={analytics.stalledTransfersRecovered}
          subValue="Adaptive Deadline Timeouts"
          icon={<ActivityIcon size={20} />}
          trend={{ text: "Zero Hangs", positive: true }}
        />
      </section>

      {/* Main Throughput Trend SVG Chart */}
      <div className="dashboard-panel chart-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Throughput Timeline: P2P Swarm vs. Origin Ingest</h2>
            <p className="panel-subtitle">
              Dynamic comparison of edge peer bandwidth vs cloud fallback bandwidth (Mbps)
            </p>
          </div>
          {selectedPoint && (
            <div className="point-inspect-pill">
              <span>Time {selectedPoint.timestamp}:</span>{' '}
              <strong className="text-success">P2P: {selectedPoint.p2pThroughputMbps} Mbps</strong> •{' '}
              <strong className="text-info">Origin: {selectedPoint.originThroughputMbps} Mbps</strong> •{' '}
              <span>{selectedPoint.activePeers} Peers</span>
            </div>
          )}
        </div>

        {/* Responsive SVG Chart */}
        <div className="chart-svg-wrapper">
          <svg viewBox="0 0 700 280" className="analytics-svg" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="40" y1="40" x2="680" y2="40" stroke="#1f2937" strokeDasharray="3 3" />
            <line x1="40" y1="90" x2="680" y2="90" stroke="#1f2937" strokeDasharray="3 3" />
            <line x1="40" y1="140" x2="680" y2="140" stroke="#1f2937" strokeDasharray="3 3" />
            <line x1="40" y1="190" x2="680" y2="190" stroke="#1f2937" strokeDasharray="3 3" />
            <line x1="40" y1="240" x2="680" y2="240" stroke="#374151" />

            {/* Y-Axis Labels */}
            <text x="32" y="44" fill="#6b7280" fontSize="10" textAnchor="end">400M</text>
            <text x="32" y="94" fill="#6b7280" fontSize="10" textAnchor="end">300M</text>
            <text x="32" y="144" fill="#6b7280" fontSize="10" textAnchor="end">200M</text>
            <text x="32" y="194" fill="#6b7280" fontSize="10" textAnchor="end">100M</text>
            <text x="32" y="244" fill="#6b7280" fontSize="10" textAnchor="end">0</text>

            {/* P2P Mesh Curve Area */}
            <polygon
              points="
                70,135
                160,117
                250,96
                340,84
                430,67
                520,45
                610,31
                610,240
                70,240
              "
              fill="rgba(16, 185, 129, 0.15)"
            />
            {/* P2P Mesh Line */}
            <polyline
              points="
                70,135
                160,117
                250,96
                340,84
                430,67
                520,45
                610,31
              "
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
            />

            {/* Origin Line */}
            <polyline
              points="
                70,208
                160,211
                250,215
                340,219
                430,220
                520,223
                610,225
              "
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeDasharray="4 4"
            />

            {/* Data Points */}
            {[
              { x: 70, y: 135, idx: 0 },
              { x: 160, y: 117, idx: 1 },
              { x: 250, y: 96, idx: 2 },
              { x: 340, y: 84, idx: 3 },
              { x: 430, y: 67, idx: 4 },
              { x: 520, y: 45, idx: 5 },
              { x: 610, y: 31, idx: 6 },
            ].map((pt) => (
              <g
                key={pt.idx}
                onClick={() => setSelectedPointIndex(pt.idx)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={selectedPointIndex === pt.idx ? '6' : '4'}
                  fill="#10b981"
                  stroke="#111827"
                  strokeWidth="2"
                />
              </g>
            ))}

            {/* X-Axis Timestamps */}
            {analytics.timeSeriesData.map((pt, i) => {
              const xPos = 70 + i * 90;
              return (
                <text
                  key={pt.timestamp}
                  x={xPos}
                  y="262"
                  fill="#9ca3af"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {pt.timestamp}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="chart-legend-row">
          <div className="legend-indicator-item">
            <span className="legend-box p2p-box" />
            <span>P2P Swarm Throughput (Green Solid)</span>
          </div>
          <div className="legend-indicator-item">
            <span className="legend-box origin-box" />
            <span>Origin Cloud Ingest (Blue Dashed)</span>
          </div>
        </div>
      </div>

      {/* Latency & Reliability Secondary Metrics */}
      <div className="dashboard-two-col">
        {/* Latency Percentiles */}
        <div className="dashboard-panel">
          <h3 className="panel-title">Latency Percentiles (RTT)</h3>
          <p className="panel-subtitle">Round-trip distribution across edge candidate connections</p>

          <div className="percentile-bars">
            <div className="percentile-row">
              <span className="p-label">p50 (Median):</span>
              <div className="p-bar-track">
                <div className="p-bar-fill p50" style={{ width: '24%' }} />
              </div>
              <span className="p-val text-success">24.2 ms</span>
            </div>

            <div className="percentile-row">
              <span className="p-label">p90:</span>
              <div className="p-bar-track">
                <div className="p-bar-fill p90" style={{ width: '58%' }} />
              </div>
              <span className="p-val text-info">86.4 ms</span>
            </div>

            <div className="percentile-row">
              <span className="p-label">p99 (Relay Tail):</span>
              <div className="p-bar-track">
                <div className="p-bar-fill p99" style={{ width: '85%' }} />
              </div>
              <span className="p-val text-warning">172.0 ms</span>
            </div>
          </div>
          <p className="percentile-sub">
            90% of swarm peers maintain sub-90ms latency, enabling high-rate pipelined chunk transfers.
          </p>
        </div>

        {/* Verification & Failure Rate */}
        <div className="dashboard-panel">
          <h3 className="panel-title">Chunk Transmission Integrity</h3>
          <p className="panel-subtitle">SHA-256 verification and retry statistics</p>

          <div className="integrity-breakdown-list">
            <div className="breakdown-item">
              <div className="item-labels">
                <span>Verified First-Attempt Chunks:</span>
                <span className="text-success font-bold">48,842 (99.84%)</span>
              </div>
              <div className="p-bar-track">
                <div className="p-bar-fill p50" style={{ width: '99.8%' }} />
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-labels">
                <span>Timeout Auto-Retried Chunks:</span>
                <span className="text-warning font-bold">78 (0.16%)</span>
              </div>
              <div className="p-bar-track">
                <div className="p-bar-fill p99" style={{ width: '0.16%' }} />
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-labels">
                <span>Corrupted / Hash Mismatch Chunks:</span>
                <span className="text-error font-bold">0 (0.00%)</span>
              </div>
              <div className="p-bar-track">
                <div className="p-bar-fill" style={{ width: '0%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
