# Project Requirements Document

**Project:** Intelligent P2P Edge File Distribution System with Adaptive Network  
**Document Version:** 1.0.0  
**Phase:** Phase 2 — Requirements & System Design  
**Status:** Approved for Architecture Baseline  

---

## 1. Problem Statement

### 1.1 Limitations of Traditional Centralized File Distribution
Modern content and large-file distribution architectures rely predominantly on centralized origin servers or commercial Content Delivery Networks (CDNs). While CDNs bring content geographically closer to consumers, they suffer from fundamental systemic limitations:

1. **Origin & Egress Bandwidth Pressures:**
   As the number of concurrent consumers ($N$) scales, outbound bandwidth requirements scale linearly $O(N)$ from the origin or edge caches. During high-concurrency distribution events (e.g., firmware rollouts, edge model weights, dataset synchronization), server egress bandwidth saturates, incurring prohibitive cloud transit costs and severe bottleneck throttling.
2. **Economic Inefficiency of Edge Caching:**
   In local area networks (LANs), enterprise branches, universities, and localized edge clusters, multiple neighboring devices frequently download identical assets independently over high-latency external WAN links, completely wasting local high-speed physical bandwidth (e.g., 1–10 Gbps Ethernet or Wi-Fi 6/7).
3. **Single Point of Congestion & Fragility:**
   Centralized endpoints present single points of congestion and failure. Network transit degradation between client ISPs and central CDNs leads to degraded download speeds, dropped packets, and broken transfers.

### 1.2 Potential Advantages of Peer-Assisted Edge Distribution
A peer-assisted edge distribution architecture introduces client-side collaboration:
- **Bandwidth Offloading:** Peers that have already received cryptographic chunks of a file act as localized seeders, redistributing chunks directly to adjacent peers over browser-native WebRTC data channels.
- **Swarm Scalability:** Total swarm distribution capacity increases proportionally with each new participant, converting downloaders into contributors.
- **Origin Protection:** Under optimal swarm density, origin server bandwidth consumption is drastically curtailed to seeding the initial copy and serving missing chunks.

### 1.3 Inherent Limitations & Edge Realities
A robust system must explicitly acknowledge edge networking constraints:
- **Asymmetric Bandwidth:** Consumer and edge nodes typically possess significantly lower upstream bandwidth than downstream bandwidth.
- **Node Churn & Transient Availability:** Edge browsers can close tabs, disconnect, or experience Wi-Fi drops at any moment without prior signaling.
- **NAT & Firewall Traversal Barriers:** Symmetric NATs and enterprise restrictive firewalls block direct peer-to-peer UDP hole punching, requiring relay mechanisms (TURN) or origin fallback.
- **Untrusted Peer Environments:** Malicious or faulty peers may send corrupted, truncated, or hostile payloads. Every chunk must be independently validated before assembly.
- **Throughput Variances:** Under low peer density or saturated peer uplinks, P2P transfer can be slower than direct origin HTTP downloads. The system must adaptively detect this and fall back to origin storage without stalling the user.

---

## 2. Project Objectives

The primary objective is to build a reliable, secure, browser-native hybrid peer-assisted file distribution platform.

### Measurable Objectives
1. **Peer-Assisted Offload Ratio:**
   Under a multi-peer swarm ($\ge 3$ active peers), measure and demonstrate demonstrable offload of origin egress bytes, aiming for $\ge 40\%$ peer contribution under healthy WebRTC mesh conditions.
2. **Cryptographic File Integrity Verification:**
   Ensure 100% data integrity using SHA-256 chunk hashing and full-file manifest hashes. Zero corrupted or partially modified chunks must ever reach the finalized reconstructed file.
3. **Adaptive Peer Selection:**
   Implement an explainable multi-factor scheduling algorithm that dynamically allocates chunk requests based on measured peer latency, effective throughput, recent success ratios, and chunk availability.
4. **Resilient Failure Recovery & Origin Fallback:**
   Guarantee uninterrupted file downloads. If a peer drops, times out, or delivers an invalid chunk, the client must automatically reschedule the chunk to another peer or seamlessly retrieve it from origin object storage within configurable timeout thresholds ($\le 5$ seconds).
5. **Real-Time Transfer Observability:**
   Provide fine-grained edge telemetry tracking download/upload rates, peer connection topologies, chunk verification statuses, origin vs. peer byte ratios, and error events.

> **Note on Performance Claims:** Performance improvements and bandwidth offload ratios are strictly target benchmarks subject to empirical measurement in later benchmarking phases; no premature claims of optimized throughput are asserted without benchmark data.

---

## 3. Functional Requirements

Functional requirements are assigned unique identifiers (`FR-xxx`), prioritized by implementation phase, and mapped to specific acceptance criteria.

| ID | Requirement Name | Description | Target Phase | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **FR-001** | User Profile & Ownership | The system shall authenticate users via Supabase Auth and assign ownership boundaries to registered files and transfer records. | Phase 3 | User identity is tied to UUID; users can view only authorized files according to access policy. |
| **FR-002** | File Registration & Metadata | The system shall accept file metadata (name, MIME type, total size, full SHA-256 hash, chunk size) and store it in PostgreSQL. | Phase 3 | File records are successfully created with UUID, created timestamp, and immutable total hash. |
| **FR-003** | Chunk Manifest Generation | The system shall split files into configurable cryptographic chunks (defaulting to 1 MiB / 1,048,576 bytes), compute individual SHA-256 hashes, and store the chunk manifest. | Phase 4 | Each chunk record contains chunk index, byte offset, byte length, and SHA-256 checksum matching binary payload. |
| **FR-004** | Peer Session Registration | Browser clients shall register an active peer session with the control plane upon entering a file swarm. | Phase 4 | A unique peer session token is generated with expiration timestamp; peer presence is recorded. |
| **FR-005** | Swarm Discovery | The control plane shall provide downloaders with a list of active peer candidates holding specific chunk subsets. | Phase 4 | Querying `/api/v1/files/{file_id}/peers` returns candidate peer IDs, supported chunk bitmaps, and connection capabilities. |
| **FR-006** | WebRTC Signaling Exchange | The backend shall coordinate WebRTC SDP offers, answers, and ICE candidates between browser peers via REST/WebSocket. | Phase 4 | Two browser clients exchange SDP/ICE through control plane and establish an open `RTCDataChannel`. |
| **FR-007** | Peer-to-Peer Chunk Transfer | Clients shall request and transfer binary chunk data directly over established WebRTC data channels using 64 KB framed messages. | Phase 5 | Chunks are streamed between peers without passing binary data through the FastAPI control plane. |
| **FR-008** | Chunk Hash Verification | Upon receiving a chunk from a peer or origin, the client shall verify the chunk payload against the authoritative manifest SHA-256 hash before committing. | Phase 5 | Mismatched chunks are immediately rejected; valid chunks are marked verified and written to temporary storage. |
| **FR-009** | Automated Origin Fallback | If a chunk request to a peer fails, times out, or if no peers hold the chunk, the client shall download the chunk directly from origin object storage. | Phase 5 | Download completes successfully even when 0 peers are connected or all peer requests terminate. |
| **FR-010** | Transfer Resumption & Retry | If a transfer is interrupted or a browser is reloaded, the client shall query existing local verified chunks and request only remaining missing chunks. | Phase 5 | No verified chunk is re-downloaded; transfer resumes from the last unverified block. |
| **FR-011** | Adaptive Chunk Scheduling | The scheduling engine shall rank candidate peers using a normalized scoring formula (throughput, latency, reliability) and assign chunks to minimize overall completion time. | Phase 6 | Faster, low-latency peers receive higher chunk concurrency than slow or erratic peers; exploratory probing is maintained. |
| **FR-012** | Local Assembly & Export | The client shall assemble verified chunks in exact sequence, verify the full-file SHA-256 hash, and trigger browser file save/export. | Phase 5 | Final exported file byte length and SHA-256 hash match the original uploaded file exactly. |
| **FR-013** | Live Telemetry & Metrics | The client shall compute real-time metrics (instantaneous speed, peer contribution percentage, origin percentage, latency) and submit periodically to the backend. | Phase 7 | UI visualizes live bandwidth graphs, swarm topology, and verified chunk completion map. |
| **FR-014** | Transfer State Management | The system shall record transfer lifecycle states (`pending`, `active`, `paused`, `completed`, `failed`, `cancelled`). | Phase 3 | Status updates reflect accurately in database and frontend views; cancellation cleanly halts open channels and cleans up temporary chunks. |
| **FR-015** | Structured Error Reporting | The system shall capture structured error logs (signaling timeouts, ICE connection failures, hash mismatches) for diagnostic inspection. | Phase 7 | Client and server log structured JSON errors containing code, message, and contextual session IDs. |

---

## 4. Non-Functional Requirements

### 4.1 Security
- **NFR-SEC-01 (Transport Encryption):** All control-plane traffic shall enforce HTTPS/TLS 1.3. All peer data channels shall use SCTP over DTLS over ICE/UDP transport as defined in RFC 8831 and RFC 8261. DTLS provides transport security (confidentiality, integrity, and endpoint authentication) for WebRTC data channels. SRTP is reserved exclusively for audio/video media streams and is not used for data channels. ICE and STUN/TURN facilitate network address discovery and traversal; they do not replace transport encryption. Transport-layer encryption protects against network eavesdropping and tampering in transit but does not make an untrusted peer or its supplied chunk content trustworthy; application-layer SHA-256 chunk hash verification is strictly mandatory.
- **NFR-SEC-02 (Zero-Trust Data Plane):** No peer shall be trusted. Every chunk received over a peer data channel must be validated against the server-authenticated SHA-256 hash before processing or persisting.
- **NFR-SEC-03 (Authentication & RLS):** API endpoints modifying file records or transfer states shall require valid JWT authentication. Database queries shall enforce Row Level Security (RLS) policies.
- **NFR-SEC-04 (Token Expiration):** Peer session tokens and signaling tickets shall expire after short durations ($\le 15$ minutes) to prevent replay and stale swarm enumeration.

### 4.2 Reliability & Availability
- **NFR-REL-01 (100% Download Completion Guarantee):** File downloads must never fail due to peer churn alone. If all peers disconnect simultaneously, the transfer must fall back to origin storage without data corruption or user restart.
- **NFR-REL-02 (Graceful Degradation):** Under restrictive corporate firewalls or networks where direct WebRTC UDP is blocked and TURN relay is unavailable or cost-prohibitive, the system must degrade gracefully to 100% origin HTTP streaming.

### 4.3 Performance & Scalability
- **NFR-PERF-01 (Client Memory Footprint & Storage Quotas):** Browser memory consumption shall be strictly bounded through streaming processing and limited in-memory buffering (e.g., buffering only active in-flight frames) rather than holding entire multi-gigabyte files in memory. Client storage strategies must account for dynamic browser storage quotas that vary by browser engine, device, available disk space, and origin storage pressure. The client should query `navigator.storage.estimate()` where supported (treating it as an advisory estimate, not a guarantee), handle `QuotaExceededError` gracefully with user-visible reporting, support the File System Access API where available with fallback to IndexedDB or origin streaming, and clean up temporary chunks on cancellation or failure.
- **NFR-PERF-02 (Signaling Latency):** Control-plane signaling message exchange (offer $\rightarrow$ answer) shall complete within $\le 500$ ms under normal network conditions.
- **NFR-PERF-03 (Chunk Verification Overhead):** SHA-256 verification of a 1 MiB chunk using the Web Cryptography API (`crypto.subtle.digest`) shall complete in $\le 20$ ms on standard modern client CPUs.

### 4.4 Observability & Maintainability
- **NFR-OBS-01 (Structured Logging):** Backend services shall emit structured JSON logs with correlation IDs (`transfer_id`, `peer_id`, `file_id`).
- **NFR-OBS-02 (Modular Code Decoupling):** Core algorithms (adaptive scoring, chunk verification, signaling protocol) must remain decoupled from UI frameworks to allow standalone unit and integration testing.

### 4.5 Accessibility & Browser Support
- **NFR-ACC-01 (Browser Standards):** The client shall support modern ECMAScript standard browsers (Chrome/Chromium 115+, Firefox 115+, Safari 16+, Edge 115+) supporting WebRTC `RTCDataChannel` and Web Cryptography API.
- **NFR-ACC-02 (UI Accessibility):** The user interface shall adhere to WCAG 2.1 AA standards for color contrast, screen reader aria attributes, and keyboard navigability.

---

## 5. Scope Boundaries

### 5.1 MVP Scope (Phases 1–6)
- React + TypeScript + Vite frontend client.
- Python FastAPI backend control plane.
- Supabase PostgreSQL for metadata and session persistence.
- Supabase Storage (S3-compatible) as the origin fallback repository.
- WebRTC data channels for browser-to-browser chunk delivery.
- REST/WebSocket signaling for peer negotiation.
- Configurable chunking (defaulting to 1 MiB) with SHA-256 manifest validation.
- Adaptive peer scoring algorithm evaluating throughput, latency, reliability, and chunk possession.
- Deterministic fallback to origin storage.
- Single-page dashboard displaying transfer progress, peer count, and chunk verification matrix.

### 5.2 Future Research & Enterprise Extensions (Post-MVP / Phase 7+)
- Dynamic variable-size chunking based on real-time MTU and network congestion.
- Forward Error Correction (Reed-Solomon erasure coding) across peer swarms.
- BitTorrent-style tit-for-tat incentive mechanisms and credit scoring.
- Dedicated distributed headless edge seeders deployed on Kubernetes or edge micro-VMs.
- End-to-end user-side public-key digital signatures (authenticity verification beyond hash integrity).

---

## 6. Constraints and Assumptions

1. **Browser Sandboxing & Storage Quotas:**
   Browser security models restrict direct filesystem access. Available client-side storage is not uniform and varies significantly by browser vendor, device architecture, operating system disk pressure, and origin-specific storage quota policies. No fixed file size can be guaranteed to fit in every client's browser storage. Systems must design for storage quota exhaustion (`QuotaExceededError`) and write failures. Where supported, `navigator.storage.estimate()` should be queried to assess available quota beforehand, understanding that returned values are non-binding estimates. For large transfers, streaming chunk processing and the File System Access API should be used where available (guarded by feature detection), with fallback to bounded IndexedDB chunk caching or direct origin streaming. The client must handle user cancellations, insufficient storage errors, and ensure temporary chunk cleanup.
2. **WebRTC RTCDataChannel Constraints:**
   Browsers limit individual message payloads over data channels. While the theoretical maximum message size varies, practical interoperability requires fragmenting chunks into 64 KB application packets and monitoring `bufferedAmount` to prevent buffer overflow.
3. **NAT Traversal & STUN/TURN Realities:**
   Direct peer-to-peer connectivity is not guaranteed for every pair of edge nodes. Direct connection establishment depends dynamically on NAT mapping behavior (e.g., full cone, port-restricted, or symmetric NAT), corporate or ISP firewall packet inspection, network topology, and transient network conditions. STUN assists in discovering public reflexive endpoints for direct UDP binding. When direct peer traversal cannot be achieved (such as between two symmetric NATs), TURN relay servers provide packet forwarding at the cost of relay bandwidth, additional network latency, operational server maintenance, and cloud egress expense. The decision of TURN infrastructure (e.g., self-hosted coturn vs. managed cloud TURN) remains an open engineering item subject to Phase 4 feasibility testing and budget review. In the absence or failure of TURN, seamless fallback to origin HTTP storage download is prioritized.
   Future networking phases will benchmark:
   - Direct connection success rate
   - TURN relay usage rate
   - Connection establishment time
   - Connection failure rate
   - Transfer completion rate by connection mode
4. **Bandwidth Asymmetry:**
   Most home broadband connections have upload speeds between 1/5th and 1/10th of download speeds. The scheduling engine assumes that peers cannot upload at line-rate download speeds and must distribute chunk requests across multiple peers concurrently.
5. **No Blind Trust:**
   A peer claiming to have a chunk cannot be assumed to provide an authentic chunk. The client must never rely on remote peer validation claims.
