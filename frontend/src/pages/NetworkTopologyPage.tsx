import React, { useState } from 'react';
import type { TopologyNode, TopologyLink, ScreenId } from '../types';
import {
  MOCK_TOPOLOGY_NODES,
  MOCK_TOPOLOGY_LINKS,
} from '../services/mockData';
import { NetworkIcon } from '../components/icons/Icons';

interface NetworkTopologyPageProps {
  onNavigate: (screen: ScreenId) => void;
}

export const NetworkTopologyPage: React.FC<NetworkTopologyPageProps> = ({
  onNavigate,
}) => {
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(
    MOCK_TOPOLOGY_NODES[0]
  );

  const nodes = MOCK_TOPOLOGY_NODES;
  const links = MOCK_TOPOLOGY_LINKS;

  const getNodeColor = (type: TopologyNode['type']) => {
    switch (type) {
      case 'local':
        return '#3b82f6'; // Bright blue
      case 'edge_peer':
        return '#10b981'; // Green
      case 'origin':
        return '#6366f1'; // Violet
      case 'turn_relay':
        return '#f59e0b'; // Amber
      default:
        return '#9ca3af';
    }
  };

  const getLinkColor = (type: TopologyLink['type']) => {
    switch (type) {
      case 'direct_p2p':
        return '#10b981'; // Green
      case 'origin_fallback':
        return '#3b82f6'; // Blue
      case 'turn_relay':
        return '#f59e0b'; // Amber
    }
  };

  return (
    <div className="page-container network-topology-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Interactive Swarm Topology:</strong> SVG node graph depicts simulated P2P mesh routing,
          distinguishing between direct WebRTC SCTP data channels, TURN relay bridges, and cloud bucket fallback.
        </div>
      </div>

      <div className="topology-layout-grid">
        {/* Left Column: Visual SVG Graph */}
        <div className="dashboard-panel topology-canvas-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Swarm Mesh Connectivity Graph</h2>
              <p className="panel-subtitle">Click on any node to view real-time link statistics and peer telemetry</p>
            </div>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => onNavigate('peers')}
            >
              <NetworkIcon size={16} />
              <span>Table View</span>
            </button>
          </div>

          <div className="svg-graph-container" role="img" aria-label="Network Topology Diagram">
            <svg viewBox="0 0 820 500" className="topology-svg" preserveAspectRatio="xMidYMid meet">
              <defs>
                <filter id="glow-p2p" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background decorative grid */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f2937" strokeWidth="0.5" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" opacity="0.6" />

              {/* Render Connection Links */}
              {links.map((link, idx) => {
                const source = nodes.find((n) => n.id === link.sourceId);
                const target = nodes.find((n) => n.id === link.targetId);
                if (!source || !target) return null;

                const strokeColor = getLinkColor(link.type);
                const isDashed = link.type !== 'direct_p2p';
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;

                return (
                  <g key={`link-${idx}`}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={strokeColor}
                      strokeWidth={link.type === 'direct_p2p' ? 2.5 : 1.75}
                      strokeDasharray={isDashed ? '6 4' : undefined}
                      strokeOpacity="0.75"
                    />
                    {/* Midpoint Latency Tag */}
                    <rect
                      x={midX - 22}
                      y={midY - 9}
                      width="44"
                      height="18"
                      rx="4"
                      fill="#111827"
                      stroke="#374151"
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      fill="#9ca3af"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {link.latencyMs}ms
                    </text>
                  </g>
                );
              })}

              {/* Render Nodes */}
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const nodeColor = getNodeColor(node.type);

                return (
                  <g
                    key={node.id}
                    className="topology-node-group"
                    onClick={() => setSelectedNode(node)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Node ${node.label} (${node.type})`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedNode(node);
                      }
                    }}
                  >
                    {/* Halo ring if selected */}
                    {isSelected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="24"
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        opacity="0.85"
                      />
                    )}

                    {/* Outer node circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.type === 'local' ? 18 : 14}
                      fill="#0f172a"
                      stroke={nodeColor}
                      strokeWidth="2.5"
                    />

                    {/* Inner core circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.type === 'local' ? 7 : 5}
                      fill={nodeColor}
                    />

                    {/* Label below node */}
                    <text
                      x={node.x}
                      y={node.y + (node.type === 'local' ? 32 : 26)}
                      fill={isSelected ? '#ffffff' : '#e2e8f0'}
                      fontSize="11"
                      fontWeight={isSelected ? '700' : '500'}
                      textAnchor="middle"
                      className="node-svg-label"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Graph Legend */}
          <div className="topology-legend-bar">
            <div className="legend-group">
              <span className="legend-title">Nodes:</span>
              <div className="legend-entry">
                <span className="node-indicator local" />
                <span>Local Client</span>
              </div>
              <div className="legend-entry">
                <span className="node-indicator peer" />
                <span>Edge Peer (P2P)</span>
              </div>
              <div className="legend-entry">
                <span className="node-indicator origin" />
                <span>Origin Server</span>
              </div>
              <div className="legend-entry">
                <span className="node-indicator relay" />
                <span>TURN Relay</span>
              </div>
            </div>

            <div className="legend-group">
              <span className="legend-title">Connections:</span>
              <div className="legend-entry">
                <span className="link-indicator p2p-link" />
                <span>WebRTC P2P (Direct)</span>
              </div>
              <div className="legend-entry">
                <span className="link-indicator relay-link" />
                <span>TURN Relay Bridge</span>
              </div>
              <div className="legend-entry">
                <span className="link-indicator origin-link" />
                <span>Cloud Fallback</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Node Inspector & Swarm Metrics */}
        <div className="topology-sidebar-col">
          {selectedNode ? (
            <div className="dashboard-panel node-inspector-panel">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Node Inspector</h3>
                  <p className="panel-subtitle">Telemetric profile for {selectedNode.label}</p>
                </div>
                <span className={`status-pill ${selectedNode.status}`}>
                  {selectedNode.status.toUpperCase()}
                </span>
              </div>

              <div className="inspector-fields">
                <div className="field-row">
                  <span className="field-name">Node ID:</span>
                  <span className="field-val"><code>{selectedNode.id}</code></span>
                </div>
                <div className="field-row">
                  <span className="field-name">Node Type:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="field-val highlight">{selectedNode.type.replace('_', ' ').toUpperCase()}</span>
                    <span className="live-tag-badge simulated">Simulated Node</span>
                  </div>
                </div>
                <div className="field-row">
                  <span className="field-name">Geographic Region:</span>
                  <span className="field-val">{selectedNode.region}</span>
                </div>
                <div className="field-row">
                  <span className="field-name">Reported Throughput:</span>
                  <span className="field-val text-success">{selectedNode.throughputMbps.toFixed(1)} Mbps</span>
                </div>
              </div>

              {/* Connected Links for selected node */}
              <div className="node-links-list">
                <h4 className="links-subheading">Active Link Connections:</h4>
                {links
                  .filter(
                    (l) =>
                      l.sourceId === selectedNode.id || l.targetId === selectedNode.id
                  )
                  .map((link, i) => {
                    const peerId =
                      link.sourceId === selectedNode.id ? link.targetId : link.sourceId;
                    const peerNode = nodes.find((n) => n.id === peerId);
                    return (
                      <div key={i} className="link-item-box">
                        <div className="link-top">
                          <strong>{peerNode?.label}</strong>
                          <span className={`link-type-tag ${link.type}`}>
                            {link.type.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="link-bottom">
                          <span>RTT: {link.latencyMs} ms</span>
                          <span>Speed: {link.throughputMbps.toFixed(1)} Mbps</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="dashboard-panel">
              <p>Select any node in the topology canvas to inspect its parameters.</p>
            </div>
          )}

          {/* Network Graph Health Metrics */}
          <div className="dashboard-panel">
            <h3 className="panel-title">Graph Mesh Health</h3>
            <div className="mesh-metrics-grid">
              <div className="mesh-metric">
                <span className="mesh-val">87.5%</span>
                <span className="mesh-label">Direct P2P Ratio</span>
              </div>
              <div className="mesh-metric">
                <span className="mesh-val">12.5%</span>
                <span className="mesh-label">TURN Fallback</span>
              </div>
              <div className="mesh-metric">
                <span className="mesh-val">8 Nodes</span>
                <span className="mesh-label">Swarm Degree</span>
              </div>
              <div className="mesh-metric">
                <span className="mesh-val">0</span>
                <span className="mesh-label">Partitioned Nodes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
