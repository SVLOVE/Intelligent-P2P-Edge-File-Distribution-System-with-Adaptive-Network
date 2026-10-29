# Phase Acceptance Criteria & Test Strategy

**Project:** Intelligent P2P Edge File Distribution System with Adaptive Network  
**Document Version:** 1.0.0  
**Phase:** Phase 2 — Requirements & System Design  
**Status:** Approved for Architecture Baseline  

---

## 1. Quality Strategy Overview

This specification establishes the verification roadmap and acceptance gates across all lifecycle phases. Testing follows a defense-in-depth model:
1. **Unit & Mathematical Verification:** Pure functions (SHA-256 chunking, normalized scoring algorithms, input validation).
2. **Contract & Schema Testing:** REST API schemas, Pydantic models, and database constraints.
3. **Integration & Protocol Testing:** WebRTC state machines, signaling coordination, and ICE gathering.
4. **Resilience & Chaos Testing:** Simulating peer dropouts, packet corruption, high latency, and origin fallback.
5. **Empirical Benchmarking:** Real-world swarm performance testing under controlled network degradation.

---

## 2. Phase-by-Phase Acceptance Matrix

| Test ID | Category | Verification Scope | Methodology & Tools | Target Phase | Pass/Fail Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Base Tooling & Health** | Verify frontend build, TypeScript types, and backend `/api/v1/health` endpoint. | Pytest, Vitest, TypeScript compiler. | **Phase 1 (Complete)** | 100% test pass; 0 compiler errors; backend and frontend start and communicate successfully. |
| **TC-02** | **Architecture & Design Review** | Complete requirements, SVD model, API contracts, database design, and adaptive algorithm. | Static inspection, markdown linting, Mermaid validation. | **Phase 2 (Current)** | All 9 required docs exist, zero unresolved schema discrepancies, valid Mermaid syntax. |
| **TC-03** | **Database Schema & Constraints** | Assert table creation, foreign keys, unique constraints, and RLS policies in PostgreSQL. | Pytest, SQLAlchemy / asyncpg, Supabase CLI testbed. | **Phase 3** | All tables migrate cleanly; RLS blocks unauthorized queries; cascading deletes work as expected. |
| **TC-04** | **Authentication & Access Boundaries** | Verify Supabase JWT token verification and user ownership enforcement on API routes. | HTTPX, Pytest with mock and real JWTs. | **Phase 3** | Anonymous calls rejected with 401; users cannot delete files owned by other users (403). |
| **TC-05** | **Signaling & ICE Candidate Brokerage** | Verify SDP Offer/Answer relaying, trickle ICE exchange, and session timeout management. | FastAPI TestClient, HTTPX, asyncio WebSockets. | **Phase 4** | Signaling messages routed to target peer within $\le 100\text{ ms}$; expired sessions automatically purged. |
| **TC-06** | **WebRTC DataChannel & NAT Traversal** | Test direct browser-to-browser data channel (SCTP/DTLS) and TURN relay fallback path. | Vitest, Puppeteer / Playwright headless WebRTC. | **Phase 4** | `RTCDataChannel` transitions to `open` state; ping/pong messages exchange cleanly; TURN relay acts as fallback if direct hole-punching fails (TURN provider selected post-feasibility test). |
| **TC-07** | **Chunking & Cryptographic Integrity** | Split files into configurable chunks (default 1 MiB); calculate SHA-256; corrupt 1 byte and verify rejection. | Vitest, Web Cryptography API (`crypto.subtle`). | **Phase 5** | 100% detection of corrupted chunks; valid chunks verify in $\le 20\text{ ms}$; reassembly matches source byte-for-byte. |
| **TC-08** | **Origin Fallback & Storage Quota Guard** | Cut WebRTC connection mid-transfer or inject storage quota pressure; assert origin fallback and quota handling. | Vitest with mock network aborts and storage errors. | **Phase 5** | Seamless transition to origin HTTP download; `QuotaExceededError` handled gracefully with user error; aborted transfers clean up temporary chunks. |
| **TC-09** | **Transfer Resumption & Idempotency** | Pause transfer at 50% or refresh browser; resume transfer from local storage cache (File System Access / IndexedDB). | Frontend integration tests with storage mocks. | **Phase 5** | Already-verified chunks are skipped; only remaining 50% are downloaded; zero duplicate bytes stored; cancellation purges partial buffers. |
| **TC-10** | **Adaptive Scheduler Peer Scoring** | Verify mathematical scoring formula: feed simulated latency, throughput, and failure inputs. | Vitest / Jest unit tests of scheduler algorithm. | **Phase 6** | Faster, low-latency peers receive higher chunk assignments; penalized peers are deprioritized. |
| **TC-11** | **Multi-Peer Swarm Collaboration** | Measure download completion across a 3-peer swarm (1 downloader, 2 seeders). | Automated multi-browser integration harness. | **Phase 6** | Both seeders concurrently supply chunks; total download duration is lower than single-peer rate. |
| **TC-12** | **End-to-End Edge Telemetry** | Assert live speed, peer count, chunk bitfield heatmap, and origin offload percentage render in UI. | React Testing Library, UI component tests. | **Phase 7** | Telemetry UI updates reactively every 1000 ms without UI stutter or memory leaks. |
| **TC-13** | **Security & Injection Fuzzing** | Fuzz API endpoints with malformed JSON, SQL injection vectors, path traversal filenames, and oversized inputs. | Python `hypothesis`, OWASP ZAP automated scanner. | **Phase 8** | 0 unhandled exceptions; 100% rejection of malicious input with structured 400/422 errors. |
| **TC-14** | **Benchmark & Traversal Performance** | Benchmark P2P offload, direct vs. TURN traversal, establishment latency, and failure rates under simulated 5-node edge network. | Custom network simulation harness with Linux `tc` netem (delay, loss, rate limit). | **Phase 8** | Measures direct connection success rate, TURN usage rate, connection establishment time, connection failure rate, and transfer completion rate across modes. P2P offload target $\ge 40\%$ under healthy conditions. |

---

## 3. Phase 2 Validation Scope

During **Phase 2**, execution is strictly limited to architectural documentation, schemas, and diagrams:
- **No production transfer code or future test runners are to be implemented in Phase 2.**
- Validation is performed by verifying document completeness, consistency, and syntax correctness.
