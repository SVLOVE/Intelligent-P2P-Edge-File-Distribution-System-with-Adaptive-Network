# Security and Privacy Requirements Specification

**Project:** Intelligent P2P Edge File Distribution System with Adaptive Network  
**Document Version:** 1.0.0  
**Phase:** Phase 2 — Requirements & System Design  
**Status:** Approved for Architecture Baseline  

---

## 1. Threat Modeling & Attack Surface Analysis

The system operates across three distinct security environments:
1. **The Authenticated Control Plane:** Managed by the FastAPI backend and Supabase infrastructure.
2. **The Public Internet Transit:** Subject to eavesdropping, packet manipulation, and NAT barriers.
3. **The Untrusted Peer Mesh:** Composed of arbitrary, unvetted browser edge nodes that may act maliciously, crash, or attempt poisoning attacks.

### Threat Matrix

| Threat ID | Threat Category | Attack Vector | Potential Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **TH-01** | **Chunk Poisoning** | Malicious peer sends altered or corrupted binary payloads over `RTCDataChannel`. | File corruption, execution of corrupted assets on client. | Mandatory client-side cryptographic SHA-256 verification against the signed manifest before accepting any chunk. Immediate peer blacklisting upon mismatch. |
| **TH-02** | **Signaling Hijacking** | Eavesdropping or tampering with SDP offers/answers and ICE candidates. | Man-in-the-Middle (MitM) peer connection establishment. | Strict HTTPS/TLS 1.3 encryption on all signaling endpoints; JWT authentication required for peer session exchange. |
| **TH-03** | **Denial-of-Service (DoS)** | Rogue peer joins swarm and advertises possessing all chunks, but intentionally withholds or stalls deliveries. | Swarm throughput stalls; user transfers blocked. | Strict timeout timers ($T_{\text{timeout}} \le 3000\text{ ms}$); rapid origin storage fallback; automated peer demotion via adaptive failure penalty $\hat{F}_i$. |
| **TH-04** | **Eavesdropping on P2P Data** | Passive network observer intercepts peer-to-peer traffic on local Wi-Fi or transit routers. | Exposure of transmitted file contents. | Mandatory DTLS 1.2+ transport encryption for all WebRTC data channels (SCTP over DTLS over ICE/UDP); encryption is enforced by the browser WebRTC stack. SRTP is reserved exclusively for audio/video media streams and is not utilized for data channels. While DTLS protects against network eavesdropping in transit, transport encryption alone does not establish peer trust; independent client-side SHA-256 chunk hash verification is strictly enforced before processing or persisting any chunk. |
| **TH-05** | **Sybil Attack** | Single malicious actor spins up dozens of fake peer sessions to dominate candidate lists. | Depletes control plane resources and pollutes swarm discovery. | Rate limiting per IP on `/peers/register`; authenticated session requirements; CAPTCHA or quota gates in future phases. |
| **TH-06** | **Metadata Enumeration** | Unauthorized crawler scrapes file catalog to discover private files. | Information disclosure of file names, hashes, and user activities. | PostgreSQL Row Level Security (RLS) policies; public vs. private file visibility flags; JWT authentication required for listing. |

---

## 2. Cryptographic Integrity vs. Author Authenticity

A critical architectural distinction must be maintained between **Data Integrity** and **Author Authenticity**:

> [!IMPORTANT]
> **Integrity is not Authenticity.**
> - **SHA-256 Chunk Hashing guarantees Data Integrity:** It proves mathematically that the binary chunk received from a peer matches byte-for-byte the chunk originally defined in the manifest.
> - **A matching hash does NOT prove who authored or uploaded the file:** A malicious user could upload malware, compute a valid SHA-256 hash, and distribute it.
> - **Mitigation:** Authenticity is established strictly through **Control Plane Identity Attestation**: the file record is cryptographically bound to the authenticated user's `profiles.id` in PostgreSQL and signed with a server attestation token. Future enterprise phases will incorporate asymmetric digital signatures (Ed25519) computed by publishing authors.

---

## 3. Trust Boundaries & Access Controls

### 3.1 Authentication & Authorization Boundaries
1. **Control Plane Access:**
   - All REST API endpoints (with the exception of `/api/v1/health` and public `/api/v1/system/info`) enforce token verification via HTTP headers (`Authorization: Bearer <token>`).
   - Token verification leverages Supabase Auth server-side verification (`/auth/v1/user`), supporting all signing algorithms (HS256, RS256, ES256) and revoking state.
   - User identity (`owner_id`) is strictly extracted from verified token claims (`auth.uid()`), never accepted from client request payloads.
2. **Server-Side Authorization & Anti-Bypass Guardrails:**
   - Possessing the Supabase service-role key on the backend bypasses database-level RLS. Therefore, the FastAPI service layer implements explicit `owner_id` verification prior to executing any read, write, or update operation.
   - Inaccessible or non-owned private resources return `404 Not Found` rather than `403 Forbidden`, preventing resource enumeration attacks.
3. **Database Row Level Security (RLS):**
   - Tables (`profiles`, `files`, `transfers`) enforce PostgreSQL RLS policies ensuring multi-tenant isolation directly in PostgreSQL.
   - Users can only query files they own or that are flagged as publicly `available`.
4. **Origin Storage Access:**
   - Supabase Object Storage buckets containing raw file blobs are configured as **Private**.
   - Direct anonymous access is rejected. Access is permitted strictly via short-lived (15-minute) pre-signed URLs generated by the FastAPI backend after confirming user download authorization.

---

## 4. Input Validation & Resource Quotas

### 4.1 Strict Input Validation
- All backend input payloads are parsed and validated via Pydantic v2 schemas:
  - File names: Sanitized against directory traversal (`../`, `..\`), restricted to 255 characters, and stripped of non-printable ASCII/Unicode control characters.
  - File sizes: Must be positive integers bounded by configured platform limits ($0 < \text{size} \le 5\text{ GB}$).
  - Hashes: Enforced regex `^[a-fA-F0-9]{64}$` for all SHA-256 fields.
  - MIME types: Validated against an allowed whitelist of standard MIME formats.

### 4.2 Rate Limiting & Abuse Prevention
FastAPI enforces IP-based and user-based token bucket rate limiting:
- `POST /api/v1/files`: 10 publications per hour per user.
- `POST /api/v1/peers/register`: 30 registrations per minute per IP.
- `POST /api/v1/signaling/*`: 120 messages per minute per session.
- `GET /api/v1/health`: 120 requests per minute per IP.

---

## 5. Privacy, Network Disclosures & Data Retention

### 5.1 WebRTC IP Disclosure Considerations
Establishing direct peer-to-peer WebRTC connections inherently reveals the client's public IP address to the peer with whom the connection is established (required for UDP packet routing).
- **Privacy Notice:** The client UI must clearly notify users that entering a peer swarm shares their network endpoint with other active swarm members.
- **VPN / Proxy / TURN Usage:** Users behind corporate networks or privacy proxies route through TURN relays without exposing their direct local IP.

### 5.2 IP Address Handling & Data Minimization
- The backend database **never stores raw, unhashed client IP addresses** in permanent tables.
- In audit logs (`audit_events`), client IP addresses are hashed using SHA-256 with a daily rotating salt:
  $$\text{ip\_hash} = \text{SHA-256}(\text{client\_ip} + \text{daily\_salt})$$
  This permits diagnostic abuse correlation within a 24-hour window without storing persistent user IP histories.
- Peer session records in `peer_sessions` are automatically marked inactive after 60 seconds of silence and purged after 24 hours.

---

## 6. Secure Logging & Secrets Hygiene

1. **No Sensitive Data in Logs:**
   - Loggers are configured to filter out `Authorization` headers, JWT tokens, file binary payloads, and internal database connection strings.
   - Error messages returned to clients contain sanitized error codes (`FILE_NOT_FOUND`, `INVALID_MANIFEST`) rather than raw database stack traces or SQL exceptions.
2. **Environment Secrets Management:**
   - Secret keys (`SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, database passwords) reside strictly in `.env` files and environment variables.
   - `.env` and `.env.local` are explicitly ignored by Git.
   - Only `.env.example` templates containing dummy placeholders are committed to version control.
   - Frontend builds never bundle backend secrets; only public anonymized keys (`VITE_API_BASE_URL`) are accessible to client code.

---

## 7. Cryptographic Merkle Security & Resource Safeguards (Phase 4.3)

1. **Domain Separation (RFC 6962 Standard):**
   - Leaf nodes are prefixed with single byte `0x00`: $\text{Leaf} = \text{SHA256}(0\text{x}00 \mathbin{\Vert} \text{chunk\_bytes})$.
   - Internal nodes are prefixed with single byte `0x01`: $\text{Node} = \text{SHA256}(0\text{x}01 \mathbin{\Vert} \text{left\_hash} \mathbin{\Vert} \text{right\_hash})$.
   - This prevents second-preimage attacks where an internal node hash could otherwise be presented as a valid leaf chunk.
2. **Authoritative Root Verification:**
   - Client-supplied inclusion proofs must verify strictly against the server's authoritative Merkle root ($H_{\text{root}}$) recorded during publication.
   - Proofs are rejected if the client claims an arbitrary or unauthenticated expected root.
3. **Bounded-Memory Streaming:**
   - Incremental streaming reads files in 1 MiB slices (`DEFAULT_CHUNK_SIZE_BYTES`), maintaining bounded memory usage even for multi-gigabyte files.
   - Temporary file uploads are streamed and cleaned up immediately upon completion or error.
4. **Untrusted Binary Containment:**
   - Uploaded binary payloads are treated as untrusted binary octet streams.
   - They are never executed, evaluated, rendered, or passed to shell processes.

---

## 8. WebRTC Signaling & Connection Security (Phase 4.4)

1. **Single-Use Ticket Authentication:**
   - Browsers do not permit custom HTTP headers in `new WebSocket(url)`.
   - Clients must first authenticate via `POST /api/v1/signaling/ticket` over HTTPS with their Bearer token.
   - The backend issues a single-use, cryptographically unpredictable ticket with a 60-second TTL.
   - Upon connection to `ws://.../signaling/ws?ticket={ticket}`, the ticket is consumed once and immediately deleted, preventing token interception in server access logs or browser history.
2. **Server-Enforced Sender Identity:**
   - The signaling service associates the authenticated user identity and socket peer ID directly upon connection.
   - The server overwrites any client-supplied `sender_peer_id` with the authenticated ID, preventing sender impersonation.
3. **Cross-Session Signaling Isolation:**
   - Peers can only exchange signaling messages (offers, answers, ICE candidates) with other authenticated peers who have joined the exact same authorized session.
   - Relay requests targeting peers outside the session are strictly rejected with an error.
4. **Signaling Payload & Rate Limits:**
   - SDP payloads are constrained to a maximum of 64 KiB (`SIGNALING_MAX_MESSAGE_BYTES = 65536`).
   - ICE candidate payloads are constrained to a maximum of 8 KiB.
   - Sliding-window rate limit enforces a maximum of 120 messages per minute per connected peer to mitigate denial-of-service or connection flooding.
5. **Origin & Transport Validation:**
   - WebSocket handshakes enforce CORS origin verification against configured allowed origins (`settings.CORS_ORIGINS`). Disallowed origins are rejected with closure code `4003`.
   - Data channels use DTLS 1.2+ encryption over SCTP over ICE.
   - Data channels in Phase 4.4 are strictly restricted to control ping/pong latency measurement; bulk binary chunk transfers are disabled until Phase 4.5.


