# System Documentation Index

**Project:** Intelligent P2P Edge File Distribution System with Adaptive Network  
**Current Phase:** Phase 2 — Requirements & System Design  

---

## Architecture & System Design Directory

This directory contains the foundational specifications, interface contracts, entity schemas, and operational designs for the project.

```
docs/
├── README.md                                          # This Master Documentation Index
├── requirements/
│   └── PROJECT_REQUIREMENTS.md                        # Functional & Non-Functional Requirements, Problem Statement, Scope
├── architecture/
│   ├── SYSTEM_ARCHITECTURE.md                         # Hybrid Architecture, Control/Data Plane Separation, Fallback
│   ├── SVD_ARCHITECTURE.md                            # System-View-Data Model, Components, and Mermaid Diagram
│   ├── SYSTEM_WORKFLOWS.md                            # Detailed Publication, Download, Failure & Scheduling Workflows
│   └── ADAPTIVE_SCHEDULING_DESIGN.md                  # Multi-factor Peer Scoring, Normalization & Exploration Strategy
├── api/
│   └── API_CONTRACTS.md                               # REST API Specifications, Schemas, Errors, and Signaling Contracts
├── database/
│   └── DATABASE_DESIGN.md                             # PostgreSQL Schemas, Tables, Constraints, Indexes & RLS Policies
├── security/
│   └── SECURITY_AND_PRIVACY_REQUIREMENTS.md           # Threat Model, Zero-Trust P2P, DTLS/TLS, IP Privacy & Secrets
└── testing/
    └── PHASE_ACCEPTANCE_CRITERIA.md                   # Verification Gates, Test Matrix & Phase Quality Milestones
```

---

## Document Summaries & Direct Links

### 1. Requirements & Scope
- [**Project Requirements (`PROJECT_REQUIREMENTS.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/requirements/PROJECT_REQUIREMENTS.md)
  - Detailed analysis of traditional CDN / centralized distribution bottlenecks.
  - Measurable project objectives (P2P offload, SHA-256 integrity, adaptive scheduling).
  - Categorized functional requirements (`FR-001` through `FR-015`) with acceptance criteria.
  - Non-functional requirements (security, reliability, performance, observability).
  - Scope boundaries (MVP vs. future research extensions) and edge constraints.

### 2. Architecture & Design Models
- [**System Architecture (`SYSTEM_ARCHITECTURE.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/SYSTEM_ARCHITECTURE.md)
  - Decoupled Control-Plane (FastAPI HTTPS) vs. Data-Plane (WebRTC DataChannel + S3 Fallback).
  - Trust boundaries, component responsibilities, and deployment limits.
  - Configurable chunking (defaulting to 1 MiB) with 64 KB application packet fragmentation and storage quota management.
  - Origin fallback triggers and execution mechanics.
- [**SVD Architecture Model (`SVD_ARCHITECTURE.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/SVD_ARCHITECTURE.md)
  - **S (System):** Compute platforms, actors, FastAPI control plane, PostgreSQL, S3, STUN/TURN.
  - **V (View):** UI presentation views, transfer monitor, chunk status heatmap, peer swarm telemetry.
  - **D (Data):** Relational database entities, transient memory buffers, and lifecycle rules.
  - Valid, comprehensive Mermaid architecture diagram.
- [**System Workflows (`SYSTEM_WORKFLOWS.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/SYSTEM_WORKFLOWS.md)
  - Step-by-step sequence diagrams and workflows for Publication, Download, Peer Dropout Recovery, Adaptive Scheduling, and Symmetric NAT Fallback.
- [**Adaptive Scheduling Design (`ADAPTIVE_SCHEDULING_DESIGN.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/ADAPTIVE_SCHEDULING_DESIGN.md)
  - Mathematical specification of peer profiling metrics ($T_i, L_i, S_i, F_i, A_{i,k}$).
  - Exponential moving averages and min-max/exponential normalization functions.
  - Weighted composite scoring formula and $\epsilon$-greedy exploration-exploitation strategy.
  - In-flight request locking and End-Game race mode to avoid transfer stragglers.

### 3. Interfaces & Data Schemas
- [**API Contracts (`API_CONTRACTS.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/api/API_CONTRACTS.md)
  - REST specifications for Health, File Metadata, Chunk Manifests, Peer Registration, WebRTC Signaling (Offer/Answer/ICE), and Transfer Lifecycle.
  - Standard JSON request/response bodies, validation constraints, and error codes.
- [**Database Design (`DATABASE_DESIGN.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/database/DATABASE_DESIGN.md)
  - Complete PostgreSQL schemas for `profiles`, `files`, `file_chunks`, `peer_sessions`, `transfers`, `transfer_chunks`, `transfer_metrics`, and `audit_events`.
  - Column types, primary/foreign keys, uniqueness constraints, index definitions, and Row Level Security (RLS) policies.

### 4. Security, Privacy & Testing
- [**Security & Privacy Requirements (`SECURITY_AND_PRIVACY_REQUIREMENTS.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/security/SECURITY_AND_PRIVACY_REQUIREMENTS.md)
  - Threat modeling (chunk poisoning, Sybil attacks, signaling hijacking, DoS).
  - Explicit distinction between Data Integrity (SHA-256) and Author Authenticity.
  - WebRTC IP privacy protections and rotating salted IP hashing in audit logs.
- [**Phase Acceptance Criteria (`PHASE_ACCEPTANCE_CRITERIA.md`)**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/testing/PHASE_ACCEPTANCE_CRITERIA.md)
  - Phase-by-phase quality gates and verification matrix covering unit, contract, integration, resilience, and benchmark tests.
