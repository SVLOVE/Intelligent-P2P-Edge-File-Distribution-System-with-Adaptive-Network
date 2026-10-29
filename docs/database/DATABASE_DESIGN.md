# Database Design Specification

**Project:** Intelligent P2P Edge File Distribution System with Adaptive Network  
**Document Version:** 1.0.0  
**Phase:** Phase 2 — Requirements & System Design  
**Target Engine:** Supabase PostgreSQL 15+  
**Status:** Approved for Architecture Baseline  

---

## 1. Design Principles & Data Lifecycle Strategy

1. **Authoritative vs. Transient Separation:**
   - The PostgreSQL database is the **authoritative system of record** for persistent identity, file catalogs, cryptographic chunk hashes, transfer audit histories, and aggregated system metrics.
   - High-frequency, ephemeral data (e.g., WebRTC SDP offers/answers, trickle ICE candidates, 64 KB packet transfer buffers, instantaneous ping measurements) reside strictly in-memory or in ephemeral cache layers. They are **never** committed to disk tables to avoid high-write I/O churn and database bloat.
2. **Row Level Security (RLS):**
   - Every public-facing table enforces PostgreSQL RLS policies tied to `auth.uid()`, guaranteeing multi-tenant isolation and strict file ownership boundaries.
3. **Auditability & Integrity:**
   - All critical operations (file registration, transfer completion, hash verification failures) write immutable records to the `audit_events` log.
4. **No Premature Migrations:**
   - This document defines the architectural target schemas. Physical SQL migrations will be created in **Phase 3**.

---

## 2. Entity-Relationship Model

```
[auth.users] (Supabase Auth)
     | 1:1
     v
 [profiles] 
     |
     +-----------------------------------+
     | 1:N                               | 1:N
     v                                   v
  [files]                         [peer_sessions]
     |                                   |
     +-------------------+               |
     | 1:N               | 1:N           |
     v                   v               |
[file_chunks]       [transfers] <--------+ (transfers link to peer_session)
                         |
                         +-------------------+
                         | 1:N               | 1:N
                         v                   v
                 [transfer_chunks]    [transfer_metrics]

 [audit_events] (Stand-alone security log)
```

---

## 3. Table Definitions

### 3.1 `profiles`
- **Purpose:** Stores application-specific profile metadata associated 1-to-1 with Supabase `auth.users`.
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | No | None | Primary key; references `auth.users(id) ON DELETE CASCADE`. |
  | `username` | `VARCHAR(50)` | No | None | Unique user display handle. |
  | `avatar_url` | `TEXT` | Yes | `NULL` | Optional link to user profile picture. |
  | `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Timestamp of record creation. |
  | `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Timestamp of last record update. |
- **Constraints & Indexes:**
  - Primary Key: `(id)`
  - Unique: `UNIQUE (username)`
  - Index: `CREATE INDEX idx_profiles_username ON profiles(username);`
- **RLS & Access Rules:**
  - `SELECT`: Allowed for authenticated users.
  - `UPDATE`: Only allowed where `auth.uid() = id`.
- **Retention:** Permanent until user account deletion.

---

### 3.2 `files`
- **Purpose:** Holds metadata for published files, overall size, and full-file SHA-256 hash.
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | No | `gen_random_uuid()` | Primary key. Unique file identifier. |
  | `owner_id` | `UUID` | No | None | References `profiles(id) ON DELETE RESTRICT`. |
  | `name` | `VARCHAR(255)` | No | None | Sanitized original filename. |
  | `mime_type` | `VARCHAR(128)` | No | `'application/octet-stream'` | MIME media type. |
  | `total_size_bytes` | `BIGINT` | No | None | Total file byte length ($> 0$). |
  | `chunk_size_bytes` | `INTEGER` | No | `1048576` | Fixed size per chunk (default 1 MB). |
  | `total_chunks` | `INTEGER` | No | None | Calculated count of chunks ($\lceil \text{size}/\text{chunk\_size}\rceil$). |
  | `sha256_hash` | `CHAR(64)` | No | None | Authoritative SHA-256 digest of entire file. |
  | `origin_storage_path` | `TEXT` | Yes | `NULL` | Path in Supabase Object Storage bucket. |
  | `status` | `VARCHAR(32)` | No | `'pending'` | Lifecycle: `'pending'`, `'active'`, `'archived'`, `'deleted'`. |
  | `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Publication registration timestamp. |
  | `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Last state update timestamp. |
- **Constraints & Indexes:**
  - Primary Key: `(id)`
  - Check: `CHECK (total_size_bytes > 0 AND total_chunks > 0)`
  - Check: `CHECK (sha256_hash ~ '^[a-fA-F0-9]{64}$')`
  - Index: `CREATE INDEX idx_files_owner ON files(owner_id);`
  - Index: `CREATE INDEX idx_files_status ON files(status);`
  - Index: `CREATE INDEX idx_files_hash ON files(sha256_hash);`
- **RLS & Access Rules:**
  - `SELECT`: Allowed for authenticated users if `status = 'active'` or `owner_id = auth.uid()`.
  - `INSERT`: Allowed for authenticated users setting `owner_id = auth.uid()`.
  - `UPDATE/DELETE`: Only allowed where `owner_id = auth.uid()`.

---

### 3.3 `file_chunks`
- **Purpose:** Authoritative chunk manifest containing offset boundaries, individual SHA-256 digests, and RFC 6962 domain-separated Merkle leaf hashes (`20261030000000_phase4_3_file_chunks_schema.sql`).
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | No | `gen_random_uuid()` | Primary key. |
  | `file_id` | `UUID` | No | None | References `files(id) ON DELETE CASCADE`. |
  | `chunk_index` | `INTEGER` | No | None | Zero-based chunk sequence index ($0 \dots N-1$). |
  | `byte_offset` | `BIGINT` | No | None | Starting byte position in file. |
  | `byte_length` | `INTEGER` | No | None | Size of this specific chunk in bytes. |
  | `sha256_hash` | `CHAR(64)` | No | None | Authoritative ordinary SHA-256 digest (`SHA256(chunk_bytes)`). |
  | `merkle_leaf_hash` | `VARCHAR(64)` | Yes | `NULL` | Domain-separated Merkle leaf hash (`SHA256(0x00 || chunk_bytes)`). |
  | `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Registration timestamp. |
- **Constraints & Indexes:**
  - Primary Key: `(id)`
  - Unique: `UNIQUE (file_id, chunk_index)`
  - Check: `CHECK (byte_offset >= 0 AND byte_length > 0)`
  - Check: `CHECK (sha256_hash ~ '^[a-fA-F0-9]{64}$')`
  - Check: `CHECK (merkle_leaf_hash IS NULL OR merkle_leaf_hash ~ '^[a-fA-F0-9]{64}$')`
  - Index: `CREATE INDEX idx_file_chunks_lookup ON file_chunks(file_id, chunk_index);`
  - Index: `CREATE INDEX idx_file_chunks_hash ON file_chunks(sha256_hash);`
- **RLS & Access Rules:**
  - Read-only for downloaders with read permissions on parent `files` (`files.owner_id = auth.uid() OR files.status = 'available'`).
  - Writable only during publication by file owner (`files.owner_id = auth.uid()`).


---

### 3.4 `peer_sessions`
- **Purpose:** Tracks active browser peer nodes participating in swarms.
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | No | `gen_random_uuid()` | Primary key. Unique session ID. |
  | `user_id` | `UUID` | No | None | References `profiles(id) ON DELETE CASCADE`. |
  | `file_id` | `UUID` | No | None | References `files(id) ON DELETE CASCADE`. |
  | `peer_id` | `VARCHAR(64)` | No | None | Client-generated WebRTC peer identifier. |
  | `role` | `VARCHAR(16)` | No | `'downloader'` | `'seeder'`, `'downloader'`, `'hybrid'`. |
  | `available_chunks_bitmap`| `TEXT` | No | `''` | Bitfield representing possessed chunks. |
  | `is_active` | `BOOLEAN` | No | `TRUE` | Liveness indicator. |
  | `last_seen_at` | `TIMESTAMPTZ` | No | `NOW()` | Updated on heartbeat (every 15s). |
  | `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Session initialization timestamp. |
- **Constraints & Indexes:**
  - Primary Key: `(id)`
  - Unique: `UNIQUE (file_id, peer_id)`
  - Index: `CREATE INDEX idx_peer_swarm ON peer_sessions(file_id, is_active, last_seen_at);`
- **Retention & Archival:**
  - Transient records: sessions with `last_seen_at < NOW() - INTERVAL '60 seconds'` are marked inactive by a background vacuum task or purged after 24 hours.

---

### 3.5 `transfers`
- **Purpose:** Records user download sessions, aggregate performance, and completion status.
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | No | `gen_random_uuid()` | Primary key. |
  | `file_id` | `UUID` | No | None | References `files(id) ON DELETE RESTRICT`. |
  | `user_id` | `UUID` | No | None | References `profiles(id) ON DELETE CASCADE`. |
  | `peer_session_id` | `UUID` | Yes | `NULL` | References `peer_sessions(id) ON DELETE SET NULL`. |
  | `status` | `VARCHAR(24)` | No | `'pending'` | `'pending'`, `'active'`, `'completed'`, `'failed'`, `'cancelled'`. |
  | `chunks_completed` | `INTEGER` | No | `0` | Count of verified completed chunks. |
  | `bytes_p2p` | `BIGINT` | No | `0` | Total payload bytes received via WebRTC. |
  | `bytes_origin` | `BIGINT` | No | `0` | Total payload bytes received via Origin HTTP. |
  | `duration_ms` | `INTEGER` | Yes | `NULL` | Total elapsed transfer duration in milliseconds. |
  | `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Transfer initiation timestamp. |
  | `completed_at` | `TIMESTAMPTZ` | Yes | `NULL` | Transfer completion timestamp. |
- **Constraints & Indexes:**
  - Primary Key: `(id)`
  - Index: `CREATE INDEX idx_transfers_user ON transfers(user_id, status);`
  - Index: `CREATE INDEX idx_transfers_file ON transfers(file_id);`
- **RLS & Access Rules:**
  - Users can read, insert, and update their own transfer records (`user_id = auth.uid()`).

---

### 3.6 `transfer_chunks`
- **Purpose:** Detailed provenance log for every individual chunk acquired during a transfer.
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | No | `gen_random_uuid()` | Primary key. |
  | `transfer_id` | `UUID` | No | None | References `transfers(id) ON DELETE CASCADE`. |
  | `chunk_id` | `UUID` | No | None | References `file_chunks(id) ON DELETE CASCADE`. |
  | `source_type` | `VARCHAR(16)` | No | None | `'p2p'` or `'origin'`. |
  | `source_peer_id` | `VARCHAR(64)` | Yes | `NULL` | Remote peer identifier if source was P2P. |
  | `verification_status` | `VARCHAR(16)` | No | `'verified'` | `'verified'`, `'corrupted_rejected'`. |
  | `download_time_ms` | `INTEGER` | No | None | Time taken to transfer the chunk. |
  | `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Timestamp when chunk was committed. |
- **Constraints & Indexes:**
  - Primary Key: `(id)`
  - Index: `CREATE INDEX idx_transfer_chunks_transfer ON transfer_chunks(transfer_id);`
  - Index: `CREATE INDEX idx_transfer_chunks_source ON transfer_chunks(source_type, verification_status);`

---

### 3.7 `transfer_metrics`
- **Purpose:** Periodic snapshot telemetry for network performance analysis and research benchmarking.
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `BIGSERIAL` | No | None | Primary key. |
  | `transfer_id` | `UUID` | No | None | References `transfers(id) ON DELETE CASCADE`. |
  | `instantaneous_speed_bps`| `BIGINT` | No | None | Current download rate in bits per second. |
  | `connected_peers_count` | `INTEGER` | No | None | Active WebRTC connections at snapshot. |
  | `average_peer_latency_ms`| `NUMERIC(7,2)` | Yes | `NULL` | Average RTT across connected peers. |
  | `p2p_offload_percentage`| `NUMERIC(5,2)` | No | None | Cumulative ratio: $\frac{\text{bytes\_p2p}}{\text{total\_bytes}} \times 100$. |
  | `recorded_at` | `TIMESTAMPTZ` | No | `NOW()` | Snapshot timestamp. |
- **Retention:** Aggregated into hourly summaries after 30 days.

---

### 3.8 `audit_events`
- **Purpose:** Security and operational audit log for sensitive system events.
- **Columns:**
  | Column Name | PostgreSQL Data Type | Nullable | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `id` | `BIGSERIAL` | No | None | Primary key. |
  | `user_id` | `UUID` | Yes | `NULL` | Acting user ID (or NULL for system). |
  | `event_type` | `VARCHAR(64)` | No | None | e.g., `'FILE_PUBLISHED'`, `'HASH_MISMATCH_DETECTED'`, `'PEER_BLACKLISTED'`. |
  | `severity` | `VARCHAR(16)` | No | `'INFO'` | `'INFO'`, `'WARNING'`, `'CRITICAL'`. |
  | `ip_hash` | `CHAR(64)` | Yes | `NULL` | SHA-256 hashed client IP (privacy-preserving). |
  | `event_metadata` | `JSONB` | No | `'{}'::jsonb`| Contextual payload (file_id, chunk_index, etc.). |
  | `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Immutable event timestamp. |
- **Constraints & Indexes:**
  - Primary Key: `(id)`
  - Index: `CREATE INDEX idx_audit_event_type ON audit_events(event_type, created_at);`
- **Retention:** Retained for 90 days for diagnostic auditing.

---

## 4. Database Migrations & Execution Guide

### 4.1 Migration File Locations
1. **Phase 4.2:** `supabase/migrations/20261029000000_phase4_2_metadata_schema.sql`
   - Scope: Implements `profiles`, `files`, and `transfers` tables with automated timestamp updates, integrity constraints, and strict Row Level Security (RLS) policies.
2. **Phase 4.3:** `supabase/migrations/20261030000000_phase4_3_file_chunks_schema.sql`
   - Scope: Implements `file_chunks` table for persistent chunk SHA-256 and Merkle leaf hash storage, RLS policies linked to file ownership, and expands `files.status` constraint.
3. **Phase 4.4:** `supabase/migrations/20261030000001_phase4_4_signaling_sessions.sql`
   - Scope: Implements `signaling_sessions` and `signaling_session_peers` tables with peer capacity caps, TTL expiration timestamps, and RLS policies for multi-tenant swarm coordination.

### 4.2 Execution Instructions
To apply these migrations to your Supabase PostgreSQL project:
```bash
# Option A: Via Supabase CLI (local or linked project)
supabase db push

# Option B: Via Supabase Dashboard SQL Editor
# Execute the SQL migration files sequentially in the SQL Editor.
```

### 4.3 Implemented Tables vs. Deferred Tables
- **Phase 4.2 Implemented:**
  - `profiles`: User identity link to `auth.users(id)`.
  - `files`: File metadata with lifecycle states. Hashes are populated genuinely via Phase 4.3.
  - `transfers`: Session tracking with `owner_id`, `direction`, `status`, and `bytes_transferred`.
- **Phase 4.3 Implemented:**
  - `file_chunks`: Persistent chunk index, byte offset, byte length, SHA-256 digest, and Merkle leaf hash.
- **Phase 4.4 Implemented:**
  - `signaling_sessions`: Authorized swarm coordination sessions with file associations and peer caps.
  - `signaling_session_peers`: Registered peer memberships in active sessions.
  - Transient WebRTC signaling messages (offers, answers, ICE candidates) reside strictly in-memory.
- **Phase 4.5 Deferred:**
  - `transfer_chunks`, `transfer_metrics` deferred to Phase 4.5 bulk data distribution.

