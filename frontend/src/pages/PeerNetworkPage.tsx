import React, { useState, useEffect } from 'react';
import type { PeerNode, ScreenId, PeerStatus, NatType } from '../types';
import { MetricCard } from '../components/MetricCard';
import { NetworkIcon, SearchIcon, CpuIcon } from '../components/icons/Icons';
import { formatSpeed } from '../utils';
import { WebRTCManager } from '../services/webrtc';
import type { LivePeerRecord, SignalingConnectionState } from '../services/webrtc';

interface PeerNetworkPageProps {
  peers: PeerNode[];
  onNavigate: (screen: ScreenId) => void;
}

export const PeerNetworkPage: React.FC<PeerNetworkPageProps> = ({
  peers,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PeerStatus | 'all'>('all');
  const [natFilter, setNatFilter] = useState<NatType | 'all'>('all');

  // Phase 4.4 WebRTC Live Signaling State
  const [webrtcManager] = useState(() => new WebRTCManager());
  const localPeerId = webrtcManager.localPeerId;
  const [signalingState, setSignalingState] = useState<SignalingConnectionState>('offline');
  const [livePeers, setLivePeers] = useState<LivePeerRecord[]>([]);
  const [sessionId, setSessionId] = useState('00000000-0000-0000-0000-000000000001');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    webrtcManager.onSignalingStateChange = (state) => {
      setSignalingState(state);
    };

    webrtcManager.onPeersChange = (peersList) => {
      setLivePeers(peersList);
    };

    webrtcManager.onError = (err) => {
      setStatusNotice(`Error: ${err}`);
    };

    webrtcManager.onLog = (log) => {
      setStatusNotice(log);
    };

    return () => {
      webrtcManager.disconnect();
    };
  }, [webrtcManager]);

  const handleConnectSignaling = async () => {
    try {
      setStatusNotice('Connecting to signaling service...');
      await webrtcManager.connectSignaling(sessionId);
    } catch (e: any) {
      setStatusNotice(`Failed: ${e.message}`);
    }
  };

  const handleDisconnectSignaling = () => {
    webrtcManager.disconnect();
    setStatusNotice('Disconnected from signaling server.');
  };

  const handleConnectP2P = async (remotePeerId: string) => {
    try {
      setStatusNotice(`Initiating WebRTC handshake with ${remotePeerId}...`);
      await webrtcManager.connectToPeer(remotePeerId);
    } catch (e: any) {
      setStatusNotice(`Handshake error: ${e.message}`);
    }
  };

  const handleSendPing = (remotePeerId: string) => {
    webrtcManager.sendControlPing(remotePeerId);
    setStatusNotice(`Sent control ping to ${remotePeerId}...`);
  };

  const handleDisconnectPeer = (remotePeerId: string) => {
    webrtcManager.closePeerConnection(remotePeerId);
    setStatusNotice(`Closed P2P connection to ${remotePeerId}.`);
  };

  const connectedPeers = peers.filter((p) => p.status === 'connected');
  const directP2pCount = peers.filter((p) => p.protocol.includes('WebRTC')).length;
  const turnRelayCount = peers.filter((p) => p.protocol.includes('TURN')).length;
  const avgLatency =
    connectedPeers.length > 0
      ? connectedPeers.reduce((acc, p) => acc + p.latencyMs, 0) / connectedPeers.length
      : 0;


  const filteredPeers = peers.filter((peer) => {
    const matchesSearch =
      peer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.ipMasked.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || peer.status === statusFilter;
    const matchesNat = natFilter === 'all' || peer.natType === natFilter;
    return matchesSearch && matchesStatus && matchesNat;
  });

  return (
    <div className="page-container peer-network-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Swarm Peer Telemetry:</strong> Peer nodes, NAT classifications, ping latencies, and
          reliability scores are simulated edge profiles used to validate ICE candidate gathering and
          the multi-factor adaptive scoring algorithm.
        </div>
      </div>

      {/* Phase 4.4 Live WebRTC Signaling & Swarm Coordination Panel */}
      <div className="webrtc-signaling-panel" role="region" aria-label="WebRTC Signaling Swarm">
        <div className="webrtc-panel-header">
          <div className="webrtc-title-wrap">
            <h3>
              <NetworkIcon size={18} />
              <span>Live WebRTC Signaling & Swarm Coordination</span>
            </h3>
            <p>
              Local Peer: <code>{localPeerId}</code> • Authenticated WebSocket ticket signaling and P2P data channels
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={`webrtc-status-pill ${signalingState}`}>
              {signalingState.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="webrtc-controls-row">
          <label htmlFor="session-id-input" style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Session UUID:</label>
          <input
            id="session-id-input"
            type="text"
            className="webrtc-input"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            disabled={signalingState !== 'offline'}
          />
          {signalingState === 'offline' || signalingState === 'disconnected' || signalingState === 'error' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConnectSignaling}
            >
              Connect to Signaling Server
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDisconnectSignaling}
            >
              Disconnect Signaling
            </button>
          )}
        </div>

        {statusNotice && (
          <div style={{ fontSize: '0.78rem', color: '#93c5fd', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
            {statusNotice}
          </div>
        )}

        {/* Live Swarm Discovered Peers */}
        {signalingState === 'session_joined' && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e5e7eb' }}>
                Discovered Live Session Peers ({livePeers.length})
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Strict Boundary: Control ping only (no binary file chunk transfer in Phase 4.4)
              </span>
            </div>

            {livePeers.length === 0 ? (
              <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
                Waiting for other browser peers to join session <code>{sessionId}</code>...
                <br />
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Tip: Open another browser window or incognito tab to connect a second authenticated peer!
                </span>
              </div>
            ) : (
              <div className="live-peers-grid">
                {livePeers.map((peer) => (
                  <div key={peer.peerId} className="live-peer-card">
                    <div className="live-peer-header">
                      <span className="live-peer-id">{peer.peerId}</span>
                      <span className={`webrtc-status-pill ${peer.p2pState}`}>
                        {peer.p2pState}
                      </span>
                    </div>
                    <div className="live-peer-stats">
                      <span>DataChannel: <strong style={{ color: peer.dataChannelState === 'open' ? '#34d399' : '#fcd34d' }}>{peer.dataChannelState}</strong></span>
                      {peer.rttMs !== undefined && (
                        <span>Measured RTT: <strong style={{ color: '#34d399' }}>{peer.rttMs} ms</strong></span>
                      )}
                    </div>
                    <div className="live-peer-actions">
                      {peer.p2pState !== 'connected' ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleConnectP2P(peer.peerId)}
                          disabled={peer.p2pState === 'connecting'}
                        >
                          {peer.p2pState === 'connecting' ? 'Handshaking...' : 'Connect P2P'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => handleSendPing(peer.peerId)}
                          >
                            Send Control Ping
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => handleDisconnectPeer(peer.peerId)}
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <section className="metrics-grid" aria-label="Swarm Peer Metrics">

        <MetricCard
          label="Total Swarm Nodes"
          value={peers.length}
          subValue={`${connectedPeers.length} Active Connections`}
          icon={<NetworkIcon size={20} />}
          badge="Edge Mesh"
        />
        <MetricCard
          label="Direct WebRTC Peers"
          value={directP2pCount}
          subValue="SCTP over DTLS"
          icon={<NetworkIcon size={20} />}
          trend={{ text: `${((directP2pCount / peers.length) * 100).toFixed(0)}% Direct P2P`, positive: true }}
        />
        <MetricCard
          label="TURN Relayed Peers"
          value={turnRelayCount}
          subValue="Symmetric NAT Fallback"
          icon={<NetworkIcon size={20} />}
          trend={{ text: "Symmetric Traversal", neutral: true }}
        />
        <MetricCard
          label="Average Swarm RTT"
          value={`${avgLatency.toFixed(1)} ms`}
          subValue="Across 6 Regions"
          icon={<NetworkIcon size={20} />}
          trend={{ text: "Sub-50ms Edge", positive: true }}
        />
      </section>

      {/* Toolbar */}
      <div className="library-toolbar">
        <div className="search-box">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search peer by name, region, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search peers"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="peer-status-select" className="filter-label">Status:</label>
          <select
            id="peer-status-select"
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PeerStatus | 'all')}
          >
            <option value="all">All States ({peers.length})</option>
            <option value="connected">Connected ({connectedPeers.length})</option>
            <option value="handshaking">Handshaking</option>
            <option value="choked">Choked / Demoted</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="peer-nat-select" className="filter-label">NAT Type:</label>
          <select
            id="peer-nat-select"
            className="filter-select"
            value={natFilter}
            onChange={(e) => setNatFilter(e.target.value as NatType | 'all')}
          >
            <option value="all">All NATs</option>
            <option value="Full Cone">Full Cone</option>
            <option value="Restricted Cone">Restricted Cone</option>
            <option value="Port Restricted">Port Restricted</option>
            <option value="Symmetric">Symmetric</option>
          </select>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onNavigate('adaptive-engine')}
        >
          <CpuIcon size={16} />
          <span>View Scoring Rationale</span>
        </button>
      </div>

      {/* Peers Table */}
      <div className="table-responsive-wrapper">
        <table className="data-table" aria-label="Edge Peer Swarm Table">
          <thead>
            <tr>
              <th>Peer Node ID & Region</th>
              <th>NAT Classification</th>
              <th>Transport Protocol</th>
              <th>Latency (RTT)</th>
              <th>Throughput</th>
              <th>Success Rate</th>
              <th>Swarm Chunks</th>
              <th>Composite Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredPeers.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-table-cell">
                  <div className="empty-state-box">
                    <p className="empty-title">No peers match selected filters</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setNatFilter('all');
                      }}
                    >
                      Reset Filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPeers.map((peer) => (
                <tr key={peer.id}>
                  <td>
                    <div className="peer-id-cell">
                      <span className={`peer-status-dot ${peer.status}`} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <strong>{peer.name}</strong>
                          <span className="live-tag-badge simulated">Simulated Profile</span>
                        </div>
                        <div className="peer-sub-ip">
                          {peer.region} • <code>{peer.ipMasked}</code>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`nat-pill ${peer.natType.toLowerCase().replace(' ', '-')}`}>
                      {peer.natType}
                    </span>
                  </td>
                  <td>
                    <span className="protocol-text">{peer.protocol}</span>
                  </td>
                  <td className="monospace-cell">
                    <span className={peer.latencyMs < 30 ? 'text-success' : peer.latencyMs < 80 ? 'text-info' : 'text-warning'}>
                      {peer.latencyMs.toFixed(1)} ms
                    </span>
                  </td>
                  <td className="monospace-cell text-success">
                    {formatSpeed(peer.throughputBps)}
                  </td>
                  <td className="monospace-cell">
                    {((peer.successRate) * 100).toFixed(1)}%
                  </td>
                  <td className="monospace-cell">
                    {peer.chunksPossessed} / {peer.totalChunksInSwarm}
                  </td>
                  <td>
                    <div className="score-cell">
                      <span className="score-val">{peer.compositeScore.toFixed(3)}</span>
                      <div className="mini-score-bar">
                        <div
                          className="mini-score-fill"
                          style={{ width: `${peer.compositeScore * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${peer.status}`}>
                      {peer.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
