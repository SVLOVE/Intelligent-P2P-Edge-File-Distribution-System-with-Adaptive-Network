/**
 * Core type definitions for the Intelligent P2P Edge File Distribution System dashboard.
 * Designed for Phase 3 UI/UX with strictly typed entities and simulated telemetry metadata.
 */

export type ScreenId =
  | 'overview'
  | 'files'
  | 'upload'
  | 'file-details'
  | 'transfers'
  | 'transfer-details'
  | 'peers'
  | 'topology'
  | 'adaptive-engine'
  | 'analytics'
  | 'activity-logs'
  | 'settings'
  | 'help'
  | 'readiness';

export type FileStatus = 'ready' | 'distributing' | 'seeding' | 'verifying' | 'metadata_only' | 'verified' | 'failed' | 'pending';

export interface ChunkProofElement {
  position: 'left' | 'right';
  hash: string;
}

export interface ChunkProofResponse {
  file_id: string;
  chunk_index: number;
  chunk_sha256: string;
  merkle_leaf_hash: string;
  merkle_root: string;
  proof: ChunkProofElement[];
}

export interface ChunkVerifyResponse {
  file_id: string;
  chunk_index: number;
  verified: boolean;
  reason?: string;
  computed_root: string;
  expected_root: string;
}

export interface ChunkInfo {
  index: number;
  chunkSha256: string; // Per-chunk cryptographic SHA-256 digest
  hash: string; // Backward compatibility alias
  sizeBytes: number;
  status: 'verified' | 'in_flight' | 'missing' | 'corrupt';
  seederCount: number;
  lastSourcePeer?: string;
  isSimulatedVerification: boolean; // false for genuine cryptographic proof verification
  merkleLeafHash?: string;
}

export interface P2PFile {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  wholeFileSha256: string; // Whole-file end-to-end SHA-256 digest
  merkleRootHash: string; // Top-level Merkle root hash derived from ordered chunk hashes
  sha256: string; // Backward compatibility alias pointing to wholeFileSha256
  totalChunks: number;
  chunkSizeBytes: number;
  status: FileStatus | string;
  seederCount: number;
  leecherCount: number;
  createdAt: string;
  description: string;
  chunks?: ChunkInfo[];
  isSimulated: boolean; // false for real files
  isPlaceholderHash: boolean; // false for genuine SHA-256 and Merkle roots
  storageNotice?: string;
}


export type TransferStatus = 'active' | 'completed' | 'paused' | 'failed' | 'queued';
export type TransferMode = 'p2p_direct' | 'hybrid_origin' | 'turn_relay';

export interface TransferSession {
  id: string;
  fileId: string;
  fileName: string;
  fileSizeBytes: number;
  status: TransferStatus;
  mode: TransferMode;
  progressPercent: number;
  chunksCompleted: number;
  totalChunks: number;
  downloadSpeedBps: number;
  uploadSpeedBps: number;
  etaSeconds: number;
  elapsedSeconds: number;
  p2pRatio: number; // 0.0 to 1.0 (portion of chunks downloaded from peers vs origin)
  connectedPeers: number;
  createdAt: string;
  isSimulated: true;
}

export type PeerStatus = 'connected' | 'handshaking' | 'choked' | 'disconnected';
export type NatType = 'Full Cone' | 'Restricted Cone' | 'Port Restricted' | 'Symmetric';

export interface PeerNode {
  id: string;
  name: string;
  region: string;
  ipMasked: string;
  natType: NatType;
  protocol: 'WebRTC (SCTP/DTLS)' | 'TURN Relay';
  latencyMs: number;
  throughputBps: number;
  successRate: number; // 0.0 to 1.0
  failureCount: number;
  status: PeerStatus;
  chunksPossessed: number;
  totalChunksInSwarm: number;
  activeRequests: number;
  maxPipelineWindow: number;
  compositeScore: number;
  lastPingTimestamp: string;
  isSimulated: true;
}

export interface TopologyNode {
  id: string;
  label: string;
  type: 'local' | 'edge_peer' | 'origin' | 'turn_relay' | 'stun';
  region: string;
  x: number;
  y: number;
  status: 'active' | 'degraded' | 'idle';
  throughputMbps: number;
}

export interface TopologyLink {
  sourceId: string;
  targetId: string;
  type: 'direct_p2p' | 'origin_fallback' | 'turn_relay';
  latencyMs: number;
  throughputMbps: number;
  active: boolean;
}

export interface AdaptiveScoreComponent {
  peerId: string;
  peerName: string;
  rawThroughputBps: number;
  normalizedThroughput: number; // w_T = 0.45
  rawLatencyMs: number;
  normalizedLatency: number; // w_L = 0.25
  successRatio: number; // w_S = 0.20
  rawFailures: number;
  failurePenalty: number; // w_F = 0.30
  compositeScore: number;
  decision: 'Exploiting' | 'Exploring' | 'Choked';
  pipelineWindow: number;
}

export interface AdaptiveEngineConfig {
  /**
   * Positive Reward Term Weights:
   * In the approved Phase 2 baseline specification, positive reward terms sum to 0.90
   * (w_T + w_L + w_S = 0.45 + 0.25 + 0.20 = 0.90).
   * Under normalized convex weighting, they sum to 1.00 (e.g. 0.50 + 0.30 + 0.20).
   */
  weightThroughput: number; // default 0.45 (positive reward for raw bandwidth)
  weightLatency: number; // default 0.25 (positive reward for low RTT latency)
  weightSuccess: number; // default 0.20 (positive reward for cryptographic delivery ratio)

  /**
   * Subtractive Risk Penalty Factor:
   * Deducted from the positive score: Score = PositiveUtility - w_F * F_hat.
   * Because it is subtractive, summing |w_T| + |w_L| + |w_S| + |w_F| = 1.20 conflates
   * additive reward criteria with deductive penalties.
   */
  weightFailure: number; // default 0.30 (subtractive penalty deduction)

  explorationEpsilon: number; // default 0.15
  decayAlpha: number; // default 0.30
  referenceLatencyMs: number; // default 250
  maxPipelineCap: number; // default 4
  minScoreThreshold: number; // default 0.10
}

export interface SystemAnalytics {
  totalBandwidthSavedBytes: number;
  swarmOffloadRatio: number;
  averageDownloadSpeedBps: number;
  averageLatencyMs: number;
  activeSwarmCount: number;
  totalPeersOnline: number;
  stalledTransfersRecovered: number;
  chunkVerificationSuccessRate: number;
  timeSeriesData: {
    timestamp: string;
    p2pThroughputMbps: number;
    originThroughputMbps: number;
    activePeers: number;
  }[];
}

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  event: string;
  peerId?: string;
  fileId?: string;
  details: string;
  component: 'Scheduler' | 'DataChannel' | 'Signaling' | 'Storage' | 'Verifier';
}

export interface UserSettings {
  defaultChunkSize: number; // bytes, e.g. 1048576 (1 MiB)
  maxUploadRateBps: number;
  maxDownloadRateBps: number;
  explorationEpsilon: number; // 0.15
  enableTelemetrySharing: boolean;
  theme: 'dark' | 'contrast';
  compactView: boolean;
  refreshIntervalSeconds: number;
}
