import type { HealthStatus } from '../types';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export interface SystemInfo {
  app_name: string;
  version: string;
  environment: string;
  api_prefix: string;
  uptime_seconds: number;
  storage_engine: string;
  database_readiness: string;
  database_status: string;
  webrtc_signaling_status: string;
  features: Record<string, boolean>;
  server_time_utc: string;
  is_development_simulation: boolean;
  notice: string;
}

/**
 * Fetch health status from FastAPI backend /api/v1/health.
 * Preserved for Phase 1 and system status banner compatibility.
 */
export async function checkBackendHealth(): Promise<HealthStatus> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/health`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Health check returned HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch system diagnostics and database readiness from /api/v1/system/info.
 */
export async function fetchSystemInfo(): Promise<SystemInfo> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/system/info`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`System diagnostics returned HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Stream a real file binary to FastAPI backend /api/v1/files/process.
 * Calculates whole-file SHA-256 and Merkle tree, and persists verified metadata.
 */
export async function processBinaryFileUpload(
  file: File,
  token?: string
): Promise<any> {
  const cleanFilename = encodeURIComponent(file.name);
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/files/process?filename=${cleanFilename}`;

  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
  };

  const authToken = token || 'test-token-00000000-0000-0000-0000-000000000001';
  headers['Authorization'] = `Bearer ${authToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: file,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to process file binary (HTTP ${response.status})`);
  }

  return response.json();
}

/**
 * Retrieve paginated chunk metadata descriptors from /api/v1/files/{file_id}/chunks.
 */
export async function fetchFileChunks(
  fileId: string,
  page: number = 1,
  limit: number = 50,
  token?: string
): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/files/${fileId}/chunks?page=${page}&limit=${limit}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch chunks (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Retrieve Merkle inclusion proof for a chunk from /api/v1/files/{file_id}/chunks/{chunk_index}/proof.
 */
export async function fetchChunkProof(
  fileId: string,
  chunkIndex: number,
  token?: string
): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/files/${fileId}/chunks/${chunkIndex}/proof`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch chunk proof (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Verify a chunk and its Merkle inclusion proof against authoritative root via /api/v1/files/{file_id}/integrity/verify.
 */
export async function verifyChunkProof(
  fileId: string,
  payload: {
    chunk_index: number;
    chunk_sha256?: string;
    merkle_leaf_hash?: string;
    proof: Array<{ position: string; hash: string }>;
    expected_merkle_root: string;
  },
  token?: string
): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/files/${fileId}/integrity/verify`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to verify chunk proof (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Fetch full file integrity manifest from /api/v1/files/{file_id}/integrity.
 */
export async function fetchFileIntegrity(
  fileId: string,
  token?: string
): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/files/${fileId}/integrity`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch file integrity manifest (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Fetch configured STUN and TURN ICE servers for WebRTC peer connections.
 */
export async function fetchIceServers(): Promise<{ ice_servers: RTCIceServer[]; is_simulated: boolean }> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/signaling/ice-servers`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ICE servers (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Request a short-lived single-use ticket for secure WebSocket signaling connection.
 */
export async function createSignalingTicket(
  sessionId?: string,
  token?: string
): Promise<{ ticket: string; user_id: string; session_id?: string; expires_in: number }> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/signaling/ticket`;
  const authToken = token || 'test-token-00000000-0000-0000-0000-000000000001';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create signaling ticket (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Register a new signaling coordination session.
 */
export async function createSignalingSession(
  name: string,
  maxPeers: number = 16,
  fileId?: string,
  token?: string
): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/signaling/sessions`;
  const authToken = token || 'test-token-00000000-0000-0000-0000-000000000001';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ name, max_peers: maxPeers, file_id: fileId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create signaling session (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * List active signaling sessions.
 */
export async function fetchSignalingSessions(): Promise<{ items: any[]; total: number }> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/v1/signaling/sessions`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to list signaling sessions (HTTP ${response.status})`);
  }
  return response.json();
}

