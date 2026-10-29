# Intelligent P2P Edge File Distribution System with Adaptive Network

## Overview
The **Intelligent P2P Edge File Distribution System with Adaptive Network** is a next-generation decentralized content distribution architecture designed for edge environments. It orchestrates peer-to-peer file chunk distribution, dynamic bandwidth adaptation, and real-time network topology optimization to maximize throughput and minimize latency across heterogeneous edge nodes.

This repository implements **Phase 1: Project Initialization**, establishing the decoupled frontend and backend foundations, developer tooling, testing infrastructure, and health-check telemetry.

---

## Architecture Overview (Phase 1)
```
+-----------------------------------+             HTTP GET /api/v1/health             +----------------------------------+
|           Frontend Tier           | ----------------------------------------------> |           Backend Tier           |
| React 19 + TypeScript + Vite      | <---------------------------------------------- | FastAPI + Uvicorn (Python 3.14)  |
| Port: 5173                        |                 JSON Status Response            | Port: 8000                       |
+-----------------------------------+                                                 +----------------------------------+
```
- **Frontend**: Lightweight React 19 application built with Vite and TypeScript, featuring environment-driven API routing, real-time backend health monitoring, and Vitest component verification.
- **Backend**: FastAPI web application running on Uvicorn with Pydantic Settings configuration, dynamic CORS middleware, modular API routing (`/api/v1`), and Pytest test client coverage.
- **Security & Git**: Strictly decoupled configuration using `.env.example` templates and comprehensive `.gitignore` rules ensuring no secrets or build artifacts are committed.

---

## Target URLs
During local development, the services are available at:
- **Frontend Web UI**: [http://localhost:5173](http://localhost:5173) (or [http://127.0.0.1:5173](http://127.0.0.1:5173))
- **Backend API Root**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Health Check Endpoint**: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
- **Interactive OpenAPI Documentation (Swagger)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## Prerequisites
Ensure the following tools are installed on your host machine:
- **Python**: 3.11+ (Python 3.14 verified)
- **Node.js**: v20+ (Node v24.19.0 verified)
- **npm**: v10+ (npm 11.17.0 verified)
- **Git**: 2.x+
- **PowerShell** (Windows) or **Bash** (Linux/macOS)

---

## Project Structure
```text
intelligent-p2p-edge/
├── frontend/                     # React + TypeScript + Vite application
│   ├── public/                   # Static public assets
│   ├── src/
│   │   ├── assets/               # Image and graphic assets
│   │   ├── components/           # Reusable UI components (HealthBadge, InitStatusCard)
│   │   ├── pages/                # Page views (LandingPage)
│   │   ├── services/             # API client services (api.ts)
│   │   ├── types/                # TypeScript interfaces and types
│   │   ├── utils/                # Utility helper functions
│   │   ├── App.tsx               # Root application shell
│   │   ├── main.tsx              # DOM entrypoint
│   │   └── index.css             # Theme tokens and responsive styling
│   ├── tests/                    # Frontend test suite (Vitest + React Testing Library)
│   ├── .env.example              # Frontend environment configuration template
│   ├── .env.local                # Local environment overrides (git-ignored)
│   ├── .gitignore                # Frontend-specific ignore rules
│   ├── index.html                # Vite HTML template
│   ├── package.json              # Frontend scripts and dependencies
│   ├── tsconfig.json             # TypeScript root configuration
│   └── vite.config.ts            # Vite bundler and Vitest configuration
├── backend/                      # Python FastAPI application
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/           # API route handlers (health.py)
│   │   ├── core/                 # Core settings and configuration (config.py)
│   │   ├── models/               # Data models (placeholder for future phases)
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── services/             # Domain logic and services
│   │   ├── tests/                # Backend test suite (pytest + HTTPX)
│   │   ├── __init__.py           # App module initializer
│   │   └── main.py               # FastAPI application entrypoint
│   ├── .env.example              # Backend environment template
│   ├── .env                      # Local environment configuration (git-ignored)
│   ├── .gitignore                # Backend-specific ignore rules
│   ├── requirements.txt          # Python pinned dependencies
│   └── .venv/                    # Python virtual environment (git-ignored)
├── docs/                         # Architecture, schemas, and specifications
├── scripts/                      # Developer utility automation scripts
├── .gitignore                    # Root repository ignore rules
├── .env.example                  # Root environment template
├── README.md                     # Master project documentation
└── roadmap.md                    # Multi-phase project delivery roadmap
```

---

## Quickstart Guide (Windows PowerShell)

### 1. Clone & Setup Environment Configuration
```powershell
# Clone the repository
git clone <repository-url>
cd intelligent-p2p-edge

# Configure environment files from templates
Copy-Item frontend\.env.example frontend\.env.local
Copy-Item backend\.env.example backend\.env
```

### 2. Backend Setup
```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
py -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Frontend Setup
```powershell
# Open a new PowerShell terminal and navigate to frontend
cd frontend

# Install dependencies
npm install
```

---

## Running the Development Servers

### Start Backend
In the backend terminal with `.venv` active:
```powershell
cd backend
.\.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
*The API will be available at `http://127.0.0.1:8000` with documentation at `http://127.0.0.1:8000/docs`.*

### Start Frontend
In the frontend terminal:
```powershell
cd frontend
npm run dev
```
*The Vite development server will start at `http://localhost:5173`.*

---

## Running Automated Tests

### Backend Tests
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest app/tests -v
.\.venv\Scripts\python.exe -m compileall app
```

### Frontend Tests & Typecheck
```powershell
cd frontend
# Run Vitest test suite
npm run test

# Run TypeScript compilation check
npm run typecheck

# Build production bundle
npm run build
```

### Automated Multi-tier Verification Script
```powershell
.\scripts\test.ps1
```

---

## API Health Check Specification

### Endpoint: `GET /api/v1/health`
- **Description**: Lightweight health and readiness probe for orchestration and frontend telemetry.
- **Status Code**: `200 OK`
- **Response Format**: `application/json`
- **Example Response**:
```json
{
  "status": "ok",
  "service": "intelligent-p2p-edge-backend",
  "version": "0.1.0"
}
```

---

## Troubleshooting

1. **Frontend shows "Disconnected"**:
   - Verify the FastAPI server is running on `http://127.0.0.1:8000`.
   - Confirm `VITE_API_BASE_URL` in `frontend/.env.local` points to `http://127.0.0.1:8000`.
   - Check browser developer tools (F12) Network tab to confirm there are no CORS or firewall blocks.

2. **CORS Errors**:
   - Verify that your frontend port is listed in `backend/.env` under `CORS_ORIGINS` (default: `["http://localhost:5173", "http://127.0.0.1:5173"]`).

3. **PowerShell Script Execution Policy**:
   - If running `Activate.ps1` produces an execution policy restriction, run:
     ```powershell
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
     ```
     or execute using the direct virtualenv binary:
     ```powershell
     .\.venv\Scripts\python.exe -m ...
     ```

---

## Architecture & System Design Documentation
Comprehensive architectural specifications, entity schemas, interface contracts, and algorithm models are available in the [`docs/`](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/README.md) directory:
- [**System Documentation Index**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/README.md)
- [**Project Requirements**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/requirements/PROJECT_REQUIREMENTS.md) (`PROJECT_REQUIREMENTS.md`)
- [**System Architecture**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/SYSTEM_ARCHITECTURE.md) (`SYSTEM_ARCHITECTURE.md`)
- [**SVD Architecture Model**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/SVD_ARCHITECTURE.md) (`SVD_ARCHITECTURE.md`)
- [**System Workflows**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/SYSTEM_WORKFLOWS.md) (`SYSTEM_WORKFLOWS.md`)
- [**Adaptive Scheduling Design**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/architecture/ADAPTIVE_SCHEDULING_DESIGN.md) (`ADAPTIVE_SCHEDULING_DESIGN.md`)
- [**REST API Contracts**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/api/API_CONTRACTS.md) (`API_CONTRACTS.md`)
- [**Database Design**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/database/DATABASE_DESIGN.md) (`DATABASE_DESIGN.md`)
- [**Security & Privacy Requirements**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/security/SECURITY_AND_PRIVACY_REQUIREMENTS.md) (`SECURITY_AND_PRIVACY_REQUIREMENTS.md`)
- [**Phase Acceptance Criteria**](file:///c:/Users/sakth/Downloads/Intelligent_P2P_Edge_Project_Docs/docs/testing/PHASE_ACCEPTANCE_CRITERIA.md) (`PHASE_ACCEPTANCE_CRITERIA.md`)

---

## Phase 4.2 — Supabase Database & Metadata Persistence

Phase 4.2 introduces PostgreSQL database persistence and token authentication via Supabase:
- **Migration Location:** `supabase/migrations/20261029000000_phase4_2_metadata_schema.sql`
- **Tables:** `profiles`, `files`, and `transfers` with automated timestamps and Row Level Security (RLS).
- **Graceful In-Memory Fallback:** When Supabase connection variables are not provided, the backend seamlessly operates with thread-safe in-memory stores, enabling all automated tests to pass without external services.
- **Environment Configuration:**
  ```env
  SUPABASE_URL="https://your-project.supabase.co"
  SUPABASE_ANON_KEY="your-anon-key"
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  SUPABASE_JWT_SECRET="your-jwt-secret"
  ```
- **Execution:**
  ```powershell
  # Run full unified regression test (Backend pytest + Frontend vitest + typecheck)
  powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
  ```

---

## Phase 4.3 — Real File Chunking, SHA-256 and Merkle Tree Integrity

Phase 4.3 implements genuine cryptographic file processing in both backend and frontend:

1. **Deterministic Binary Chunking:**
   - 1 MiB standard chunk slices (`DEFAULT_CHUNK_SIZE_BYTES = 1048576`).
   - Incremental streaming processor (`crypto_service.process_binary_stream`) with bounded memory.
2. **SHA-256 Digest Integrity:**
   - Whole-file SHA-256 calculated over the complete byte stream in exact sequence.
   - Per-chunk SHA-256 calculated over individual 1 MiB slices.
3. **Domain-Separated Binary Merkle Tree (RFC 6962 Standard):**
   - **Leaf Hash:** `SHA256(0x00 || chunk_bytes)`
   - **Internal Node Hash:** `SHA256(0x01 || left_hash_bytes || right_hash_bytes)`
   - **Empty Tree Root:** `SHA256(0x02)` $\to$ `dbc1b4c900ffe48d575b5da5c638040125f65db0fe3e24494b76ea986457d986`
   - **Odd-Node Rule:** When an odd number of nodes exists at a tree level, the final node is duplicated.
   - **Inclusion Proofs:** Audit path generation (`get_proof`) and verification (`verify_inclusion_proof`) rejecting malformed or tampered proofs.
4. **Database & API Integration:**
   - Migration `20261030000000_phase4_3_file_chunks_schema.sql` creates `file_chunks` table with unique constraint on `(file_id, chunk_index)` and RLS policies.
   - Endpoints: `POST /files/process`, `POST /files/{id}/chunks`, `GET /files/{id}/chunks`, `GET /files/{id}/chunks/{idx}/proof`, `POST /files/{id}/integrity/verify`, `GET /files/{id}/integrity`.
5. **Frontend Web Crypto Integration:**
   - `frontend/src/utils/crypto.ts` runs native browser `crypto.subtle` hashing.
   - Visual distinction between verified cryptographic data and simulated development fixtures.
   - Interactive Merkle proof verification from chunk bitfield grid.

---

## Phase 4.4 — WebRTC Signaling, Peer Discovery and Connection Management

Phase 4.4 implements real WebRTC connection infrastructure so authenticated browser peers can discover authorized sessions, exchange signaling messages, establish peer-to-peer connections, and measure real connection round-trip latency:

1. **Authenticated FastAPI WebSocket Signaling Service:**
   - Single-use ticket authentication via `POST /api/v1/signaling/ticket` (60s TTL, consumed once and deleted).
   - In-memory active connection registry (`SignalingService`) tracking live sockets, session peers, and sliding rate limits (120 msg/min).
   - Server-enforced sender identity to prevent peer ID impersonation.
   - Cross-session signaling isolation: peers can only message peers in their active session.
   - Bounded payload sizes: maximum 64 KiB for SDP envelopes; maximum 8 KiB for ICE candidates.
2. **Database Migration & Sessions:**
   - Migration `20261030000001_phase4_4_signaling_sessions.sql` creates `signaling_sessions` and `signaling_session_peers` tables with peer capacity caps, TTL timestamps, and RLS policies.
   - Endpoints: `POST /api/v1/signaling/ticket`, `GET /api/v1/signaling/ice-servers`, `POST /api/v1/signaling/sessions`, `GET /api/v1/signaling/sessions`, `GET /api/v1/signaling/sessions/{session_id}`, `WebSocket /api/v1/signaling/ws`.
3. **Frontend WebRTC Manager (`frontend/src/services/webrtc.ts`):**
   - Native browser `RTCPeerConnection` and `RTCDataChannel` coordination.
   - W3C WebRTC Perfect Negotiation pattern (polite vs. impolite role calculation) eliminating glare and offer collisions.
   - Queued candidate strategy: trickle ICE candidates arriving before `setRemoteDescription` are queued and drained safely.
   - `p2p-control` DataChannel: opens direct SCTP over DTLS channel, sends small control ping/pong messages, and measures actual round-trip latency (RTT in ms).
4. **UI Integration:**
   - Interactive Live WebRTC Signaling & Swarm Coordination panel on the `Peer Network` page.
   - Honest presence indicators (`offline`, `connecting`, `connected`, `session_joined`, `error`).
   - Distinct badges clearly separating Live WebRTC nodes from simulated edge profiles.
5. **Manual Browser-to-Browser Test Procedure:**
   1. Open two browser windows (or one normal tab and one private/incognito window) navigating to `http://localhost:5173`.
   2. Navigate to **Peer Network** on both clients.
   3. On Client 1, click **Connect to Signaling Server**. The status updates to `session_joined` with a unique Local Peer ID.
   4. On Client 2, click **Connect to Signaling Server**. Client 2 automatically discovers Client 1 in the session peer list; Client 1 receives a real-time `peer_joined` notification.
   5. On either client, click **Connect P2P**. Both peers negotiate WebRTC offer/answer and ICE candidate exchange via WebSocket.
   6. Connection transitions to `connected` and the `p2p-control` DataChannel opens.
   7. Click **Send Control Ping** to observe genuine measured round-trip latency (RTT in ms).
   8. Disconnecting either peer cleanly removes the connection and notifies the session.
6. **Strict Phase Boundary:**
   - Real binary file chunk transmission, adaptive chunk scheduling, and swarm distribution remain strictly deferred to Phase 4.5.

---

## Next Steps
Phase 4.4 is complete. Future development will proceed to **Phase 4.5: WebRTC File Chunk Transfer & Distribution** upon explicit user request.


