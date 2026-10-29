# API Contracts Specification

**Project:** Intelligent P2P Edge File Distribution System with Adaptive Network  
**Document Version:** 1.0.0  
**Phase:** Phase 2 — Requirements & System Design  
**Status:** Approved for Architecture Baseline  

---

## 1. Global Conventions

### 1.1 Base URL & Content Negotiation
- Base Path: `/api/v1`
- Content Type: `application/json` for all request and response payloads.
- Date/Time Format: ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SS.sssZ`).
- Identifiers: RFC 4122 compliant UUID v4 strings.

### 1.2 Authentication & Security Headers
Endpoints requiring authentication enforce Bearer token verification via HTTP headers:
```http
Authorization: Bearer <supabase_jwt_token>
```
Standard security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 1.3 Standard Error Response Schema
All error responses adhere to the following structure:
```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human-readable explanation of error.",
    "details": {},
    "timestamp": "2026-10-29T21:30:00.000Z"
  }
}
```

---

## 2. Health & System Readiness

### 2.1 GET `/api/v1/health`
- **Purpose:** Service health check and readiness probe.
- **Authentication:** Public (No token required).
- **Rate Limit:** 120 requests/minute per IP.
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "intelligent-p2p-edge-backend",
  "version": "0.1.0"
### 2.2 GET `/api/v1/system/info`
- **Purpose:** Diagnostics, runtime environment, feature flags, and database readiness disclosure.
- **Authentication:** Public.
- **Response `200 OK`:**
```json
{
  "app_name": "Intelligent P2P Edge Backend",
  "version": "0.1.0",
  "environment": "development",
  "api_prefix": "/api/v1",
  "uptime_seconds": 128.45,
  "storage_engine": "in_memory_development",
  "database_readiness": "unconfigured_in_memory_fallback",
  "database_status": "ready",
  "webrtc_signaling_status": "mock_inactive",
  "features": {
    "p2p_chunk_distribution": true,
    "adaptive_scheduler_engine": true,
    "merkle_integrity_verification": true,
    "supabase_cloud_persistence": false,
    "live_webrtc_signaling": false
  },
  "server_time_utc": "2026-10-29T21:30:00.000Z",
  "is_development_simulation": true,
  "notice": "Phase 4.2 backend with Supabase database integration. Live WebRTC peer channels remain disabled."
}
```

---

## 3. File Metadata Endpoints

### 3.1 POST `/api/v1/files`
- **Purpose:** Registers a new file publication record. Authenticated identity becomes the authoritative `owner_id`.
- **Authentication:** Required (`Bearer <JWT>`).
- **Validation Rules:**
  - `name`: 1–255 characters, sanitized against path traversal characters (`..`, `/`, `\`).
  - `total_size_bytes`: Integer $> 0$, $\le 5\text{ GB}$ (configurable limit).
  - `sha256_hash` / `whole_file_sha256`: Optional/nullable or 64 hex characters (`^[a-fA-F0-9]{64}$`).
  - `merkle_root_hash`: Optional/nullable or 64 hex characters (`^[a-fA-F0-9]{64}$`).
  - `chunk_size_bytes`: Exactly `1048576` (1 MB) in current specification.
  - `total_chunks`: Must match $\lceil \text{total\_size\_bytes} / \text{chunk\_size\_bytes} \rceil$.
- **Request Body:**
```json
{
  "name": "edge_model_weights.bin",
  "mime_type": "application/octet-stream",
  "total_size_bytes": 104857600,
  "chunk_size_bytes": 1048576,
  "total_chunks": 100,
  "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "merkle_root_hash": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
}
```
- **Response `201 Created`:**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "owner_id": "00000000-0000-0000-0000-000000000001",
  "name": "edge_model_weights.bin",
  "status": "metadata_only",
  "total_size_bytes": 104857600,
  "chunk_size_bytes": 1048576,
  "total_chunks": 100,
  "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "merkle_root_hash": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
  "is_simulated": true,
  "storage_notice": "Metadata-only registration. Binary file bytes have not been uploaded.",
  "created_at": "2026-10-29T21:30:00.000Z",
  "updated_at": "2026-10-29T21:30:00.000Z"
}
```
- **Errors:**
  - `400 Bad Request`: `INVALID_METADATA_FORMAT` or `FILE_SIZE_EXCEEDED`
  - `401 Unauthorized`: `UNAUTHORIZED` (missing or invalid bearer token)
  - `409 Conflict`: `FILE_HASH_ALREADY_REGISTERED`
  - `422 Unprocessable Content`: `VALIDATION_ERROR`

### 3.2 GET `/api/v1/files`
- **Purpose:** Lists registered files accessible to the requesting user.
- **Authentication:** Required (`Bearer <JWT>`).
- **Query Parameters:**
  - `page` (default: 1), `limit` (default: 20, max: 100), `status` (optional: `active`, `pending`).
- **Response `200 OK`:**
```json
{
  "items": [
    {
      "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "edge_model_weights.bin",
      "total_size_bytes": 104857600,
      "total_chunks": 100,
      "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "status": "active",
      "active_seeders": 4,
      "created_at": "2026-10-29T21:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

### 3.3 GET `/api/v1/files/{file_id}`
- **Purpose:** Retrieves complete metadata for a specific file.
- **Authentication:** Required (`Bearer <JWT>`).
- **Response `200 OK`:** Returns full file object including owner, status, and swarm summary.
- **Errors:** `404 Not Found` if file does not exist or user lacks access.

### 3.4 DELETE `/api/v1/files/{file_id}`
- **Purpose:** Decommissions a file and marks it deleted.
- **Authentication:** Required (User must be file owner or admin).
- **Response `204 No Content`:** Deleted successfully.
- **Errors:** `403 Forbidden` if user is not the owner.

---

## 4. Chunk Manifest Endpoints

### 4.1 POST `/api/v1/files/{file_id}/chunks`
- **Purpose:** Uploads the complete cryptographic chunk manifest (index, byte offsets, SHA-256 hashes).
- **Authentication:** Required (Owner only).
- **Validation Rules:**
  - Manifest chunk count must match `total_chunks` defined in file record.
  - Chunk indices must be contiguous starting from 0 to $N-1$.
  - Each `sha256_hash` must be valid 64-character hex.
- **Request Body:**
```json
{
  "chunks": [
    {
      "chunk_index": 0,
      "byte_offset": 0,
      "byte_length": 1048576,
      "sha256_hash": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    },
    {
      "chunk_index": 1,
      "byte_offset": 1048576,
      "byte_length": 1048576,
      "sha256_hash": "48a24b70a0b376535542b996af51739825ee380f47dc1ced0f769cc387864e59"
    }
  ]
}
```
- **Response `201 Created`:**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "chunks_registered": 100,
  "status": "ready"
}
```

### 4.2 GET `/api/v1/files/{file_id}/chunks`
- **Purpose:** Downloads the paginated chunk manifest needed by downloaders to verify received chunks.
- **Authentication:** Optional/Required (`Bearer <JWT>`).
- **Query Parameters:** `page` (default: 1), `limit` (default: 50, max: 1000).
- **Response `200 OK`:** Returns paginated list of chunk descriptors with SHA-256 and Merkle leaf hashes.

### 4.3 GET `/api/v1/files/{file_id}/chunks/{chunk_index}/proof`
- **Purpose:** Retrieves cryptographic Merkle audit path proving chunk membership in the file's binary Merkle tree.
- **Authentication:** Optional/Required (`Bearer <JWT>`).
- **Path Parameters:** `file_id` (UUID v4), `chunk_index` (integer $\ge 0$).
- **Response `200 OK`:**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "chunk_index": 0,
  "chunk_sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "merkle_leaf_hash": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  "merkle_root": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
  "proof": [
    { "position": "right", "hash": "48a24b70a0b376535542b996af51739825ee380f47dc1ced0f769cc387864e59" }
  ]
}
```

### 4.4 POST `/api/v1/files/{file_id}/integrity/verify`
- **Purpose:** Verifies a chunk payload or leaf hash and its audit path against the authoritative expected Merkle root.
- **Authentication:** Optional/Required (`Bearer <JWT>`).
- **Request Body:**
```json
{
  "chunk_index": 0,
  "merkle_leaf_hash": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  "proof": [
    { "position": "right", "hash": "48a24b70a0b376535542b996af51739825ee380f47dc1ced0f769cc387864e59" }
  ],
  "expected_merkle_root": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
}
```
- **Response `200 OK`:**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "chunk_index": 0,
  "verified": true,
  "reason": null,
  "computed_root": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
  "expected_root": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
}
```

### 4.5 GET `/api/v1/files/{file_id}/integrity`
- **Purpose:** Retrieves complete cryptographic integrity manifest with whole-file SHA-256 and Merkle root.
- **Response `200 OK`:** Returns `FileIntegrityManifestResponse`.

### 4.6 POST `/api/v1/files/process`
- **Purpose:** Incrementally streams raw binary file payload, splits into 1 MiB chunks, calculates genuine SHA-256 digests and domain-separated Merkle tree, and persists verified metadata.
- **Authentication:** Required (`Bearer <JWT>`).
- **Query Parameter:** `filename` (string, sanitized).
- **Headers:** `Content-Type: application/octet-stream`.
- **Response `201 Created`:** Returns `FileIntegrityManifestResponse` with `status: "verified"`.


---

## 5. Peer Discovery & WebRTC Signaling Endpoints

### 5.1 POST `/api/v1/peers/register`
- **Purpose:** Registers an edge browser as an active peer in a specific file swarm.
- **Authentication:** Required (`Bearer <JWT>`).
- **Request Body:**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "peer_id": "peer_usr9482_ab71ef",
  "role": "seeder",
  "supported_chunks_bitmap": "1111111111"
}
```
- **Response `200 OK`:**
```json
{
  "session_token": "pst_98a7cf23e1",
  "heartbeat_interval_seconds": 15,
  "stun_turn_servers": [
    { "urls": "stun:stun.l.google.com:19302" }
  ]
}
```

### 5.2 GET `/api/v1/files/{file_id}/peers`
- **Purpose:** Discovers candidate peers holding chunks for the file.
- **Authentication:** Required (`Bearer <JWT>`).
- **Query Parameters:**
  - `exclude_peer_id`: Current client's peer ID (avoids self-matching).
  - `limit`: Default 10, max 30.
- **Response `200 OK`:**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "peers": [
    {
      "peer_id": "peer_usr4412_98d7fa",
      "available_chunks_bitmap": "1111111111",
      "measured_upload_capacity_kbps": 5000,
      "last_seen_seconds_ago": 2
    }
  ]
}
```

### 5.3 POST `/api/v1/signaling/ticket`
- **Purpose:** Issues an unpredictable, short-lived single-use ticket for secure browser WebSocket connection without exposing credentials.
- **Authentication:** Required (`Bearer <supabase_jwt_token>`).
- **Request Body (Optional):**
```json
{
  "session_id": "00000000-0000-0000-0000-000000000001"
}
```
- **Response `201 Created`:**
```json
{
  "ticket": "cryptographic_single_use_ticket_string",
  "user_id": "00000000-0000-0000-0000-000000000001",
  "session_id": "00000000-0000-0000-0000-000000000001",
  "expires_in": 60
}
```

### 5.4 GET `/api/v1/signaling/ice-servers`
- **Purpose:** Returns sanitized public STUN and configured TURN servers for WebRTC ICE candidate gathering.
- **Authentication:** Public.
- **Response `200 OK`:**
```json
{
  "ice_servers": [
    { "urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ],
  "is_simulated": false,
  "notice": "Configured STUN/TURN servers for WebRTC ICE candidate gathering and NAT traversal."
}
```

### 5.5 POST `/api/v1/signaling/sessions`
- **Purpose:** Creates an authorized swarm coordination session.
- **Authentication:** Required (`Bearer <supabase_jwt_token>`).
- **Request Body:**
```json
{
  "name": "Research Swarm Alpha",
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "max_peers": 16
}
```
- **Response `201 Created`:** Session descriptor with status `active`.

### 5.6 WebSocket `/api/v1/signaling/ws?ticket={ticket}&peer_id={peer_id}`
- **Purpose:** Real-time bidirectional WebRTC signaling exchange (join, offer, answer, ice_candidate, ping/pong).
- **Authentication:** Single-use ticket via query parameter (consumed once and invalidated).
- **Protocol:** JSON message envelope (`v1`):
```json
{
  "protocol_version": "v1",
  "type": "offer",
  "session_id": "00000000-0000-0000-0000-000000000001",
  "sender_peer_id": "peer-caller",
  "target_peer_id": "peer-callee",
  "sdp": "v=0\r\no=- ...\r\ns=-\r\nt=0 0\r\na=sendrecv..."
}
```
- **Supported Message Types:** `join_session`, `session_joined`, `peer_joined`, `peer_left`, `offer`, `answer`, `ice_candidate`, `connection_state`, `leave_session`, `ping`, `pong`, `error`.
- **Security Constraints:** Server overwrites `sender_peer_id` with authentic socket peer ID; cross-session relay is blocked; maximum SDP payload is 64 KiB; maximum ICE candidate payload is 8 KiB; sliding rate limit is 120 msgs/min.

---

## 6. Transfer Lifecycle Endpoints

### 6.1 POST `/api/v1/transfers`
- **Purpose:** Creates a transfer tracking session for recording progress and metrics.
- **Request Body:**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "transfer_mode": "hybrid_p2p"
}
```
- **Response `201 Created`:** Returns `transfer_id` and initial status `active`.

### 6.2 GET `/api/v1/transfers/{transfer_id}`
- **Purpose:** Retrieves progress, verified chunk ratio, and recorded performance metrics.
- **Response `200 OK`:**
```json
{
  "transfer_id": "t982b10a-319a-4c90-b9df-415891ac3710",
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "active",
  "chunks_total": 100,
  "chunks_completed": 45,
  "bytes_from_p2p": 36700160,
  "bytes_from_origin": 10485760,
  "p2p_ratio_percentage": 77.7
}
```

### 6.3 POST `/api/v1/transfers/{transfer_id}/cancel`
- **Purpose:** Cancels an in-progress transfer, notifying the control plane to free swarm slot.
- **Response `200 OK`:** Status updated to `cancelled`.
