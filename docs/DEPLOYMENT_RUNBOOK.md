# ThreadFlow — Production Deployment & Operations Runbook (`DEPLOYMENT_RUNBOOK.md`)

This runbook provides complete instructions for provisioning, containerizing, deploying, and maintaining the **ThreadFlow** platform for Company A's knitwear operations in Tiruppur.

---

## 1. System Requirements & Architecture Sizing

### Host Environment Sizing (Production Monolith)
* **Target OS:** Ubuntu 22.04 LTS / 24.04 LTS or Debian 12 (Linux x86_64 or ARM64)
* **Compute:** 4 vCPUs (minimum 2 vCPUs)
* **Memory:** 8 GB RAM (minimum 4 GB RAM)
* **Storage:** 40+ GB SSD (with automated WAL backup)
* **Networking:** Ports 80 (HTTP), 443 (HTTPS), and 4000 (Backend API internal/external)

### Client Floor Device Requirements
* **Floor Supervisors:** Android 9.0+ smartphone with 2–3 GB RAM (e.g. Redmi 9A, Samsung Galaxy M04) running Chrome 108+ (supports PWA install, IndexedDB offline persistence, and Web Speech API `ta-IN`).
* **Merchandisers & Buyers:** Modern desktop web browser (Chrome, Edge, Firefox, Safari) with 1080p+ display.

---

## 2. Environment Configuration (`.env`)

ThreadFlow uses standard environment variables. Never commit production secrets to Git.

```bash
# ========================================================
# THREADFLOW ENVIRONMENT CONFIGURATION
# ========================================================

# Core Server Configuration
PORT=4000
NODE_ENV=production
APP_ORIGIN=http://localhost:5173
API_PREFIX=/api/v1

# Supabase / PostgreSQL Database URLs
# Shared transaction-mode pooler (IPv4-compatible)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct session-mode connection (used for Prisma migrations)
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# Connection Pool Tuning
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_TIMEOUT_MS=10000

# Security & Cryptography
ENCRYPTION_MASTER_KEY="GENERATE_64_CHAR_HEX_RANDOM_KEY"
JWT_ACCESS_SECRET="GENERATE_64_CHAR_HEX_ACCESS_SECRET"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_SECRET="GENERATE_64_CHAR_HEX_REFRESH_SECRET"
JWT_REFRESH_EXPIRY="7d"

# Operational Timeline Calibration
SIMULATED_TODAY_DATE="2026-11-02"

# Google Gemini AI Integration (Tamil/Hindi Voice Transcription & Root Cause NLP)
AI_PROVIDER=gemini
AI_MODEL=gemini-3.1-flash-lite
AI_API_KEY="YOUR_GEMINI_API_KEY"
AI_TIMEOUT_MS=3000
AI_CONFIDENCE_THRESHOLD=0.65
```

---

## 3. Quick Start: Local Development Setup

### Prerequisites
* Node.js v20+ (LTS)
* npm v10+

### Step-by-Step Installation

```bash
# 1. Clone repository
git clone https://github.com/AgnivaSardar/ThreadFlow.git
cd ThreadFlow

# 2. Setup backend environment and install dependencies
cd backend
npm install

# 3. Synchronize database schema with Supabase PostgreSQL
npx prisma db push

# 4. Seed realistic production data (orders, milestones, logs, audit events)
npm run seed:calibrated

# 5. Run automated test suites (128/128 tests passing)
npm test

# 6. Start backend development server (port 4000)
npm run dev
```

In a second terminal:

```bash
# 7. Setup frontend and start development server (port 5173)
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173` to access the ThreadFlow workspace.

---

## 4. Containerized Production Deployment (Docker & Docker Compose)

The repository includes production-ready multi-stage Dockerfiles for both frontend and backend.

### Running with Docker Compose

```bash
# 1. Ensure .env has valid DATABASE_URL and JWT secrets
# 2. Build and launch services
docker-compose up -d --build

# 3. Check container logs
docker-compose logs -f
```

### Services Orchestrated
| Service | Image/Context | Exposed Port | Purpose |
| :--- | :--- | :--- | :--- |
| `threadflow-backend` | `./backend/Dockerfile` (Node 20 Alpine) | `4000:4000` | Express REST API, Prisma ORM, Gemini AI bridge, PDF generator |
| `threadflow-frontend` | `./frontend/Dockerfile` (Nginx Alpine) | `80:80`, `5173:80` | Production React SPA with client-side routing & `/api/v1` reverse proxy |

---

## 5. Reviewer Pre-Configured Demo Accounts

All accounts use default password: `ThreadFlow@2026`

| Persona | Email | Assigned Role | Capabilities & Recommended Walkthrough |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@threadflow.com` | `ADMIN` | Global administrative access across all factory units, orders, audit logs, and system settings. |
| **Senior Merchandiser** | `merchandiser@company-a.com` | `MERCHANDISER` | Factory Order Board (Green/Amber/Red), Order & TNA setup, run-rate math details, AI issue confirmation gate, What-If simulator, and weekly PDF report generation. |
| **Floor Supervisor (Unit 1)** | `supervisor.muthu@company-a.com` | `SUPERVISOR` | Mobile floor workspace for Unit 1, stage output entry, Tamil/Hindi/English voice input, photo proof capture, and offline IndexedDB sync. |
| **Floor Supervisor (Unit 2)** | `supervisor.selvam@company-a.com` | `SUPERVISOR` | Mobile floor workspace for Unit 2 & 3 stitching lines. |
| **UK Foreign Buyer** | `sourcing@company-b.co.uk` | `BUYER` | Scoped Buyer Portal viewing POs `B-PO-88213` and `B-PO-88240`, confirmed photos, milestones, and weekly reports with zero access to other brands' data. |
| **German Foreign Buyer** | `compliance@company-c.de` | `BUYER` | Scoped Buyer Portal viewing PO `C-PO-0488`. |

---

## 6. Health Checks & Authoritative Clock Verification

ThreadFlow provides built-in system verification endpoints:

```bash
# Health check
curl http://localhost:4000/api/v1/health
# Response: {"status":"ok","timestamp":"2026-11-04T07:45:00.000Z"}

# Authoritative server clock (immune to client clock tampering)
curl http://localhost:4000/api/v1/time
# Response: {"success":true,"serverTimeIso":"...","timezone":"Asia/Kolkata"}
```

---

## 7. Automated Test Suite Execution

Run all 4 test suites covering 128 production invariants:

```bash
npm --prefix backend test
```

* **Feature 5 (Show-Your-Math Engine):** 34 tests covering Sunday calendar exclusions, 3-day weighted moving average (0.50/0.30/0.20), Tiruppur knitwear stage buffers, and financial exposure calculations in Rupees.
* **Feature 9 (Resilient Tamil AI Pipeline):** 35 tests covering Gemini 3.1 Flash Lite API integration, timeout racing (< 3,000 ms SLA), and deterministic regex fallback dictionaries.
* **Feature 3 & 4 (Orders & TNA Pipeline):** 32 tests covering 7-stage knitwear milestones, size breakdowns, optimistic locking, and tamper-evident audit chaining.
* **Feature 8 (Production Ingestion & Invariants):** 27 tests covering anti-finger-slip sequence checks, 3% fabric tolerance ceilings, UUIDv4 idempotency replay protection, and cryptographic Merkle chain validation.
