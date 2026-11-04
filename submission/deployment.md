# ThreadFlow — Deployment & Operations Guide (`deployment.md`)

This guide provides instructions for deploying, running, and reviewing the **ThreadFlow** Knitwear Production Intelligence & Critical Path OS for Company A (Tiruppur, Tamil Nadu).

---

## 1. Quick Start: Local Step-by-Step Setup

### Prerequisites
* **Node.js**: v20.x or newer (LTS recommended)
* **npm**: v10.x or newer
* **PostgreSQL Database**: PostgreSQL 16 (or cloud PostgreSQL instance, e.g., Supabase / Neon / AWS RDS)

### Step 1: Clone the Repository
```bash
git clone https://github.com/AgnivaSardar/ThreadFlow.git
cd ThreadFlow
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in the root directory (and in `backend/.env`):
```bash
cp .env.example .env
cp .env.example backend/.env
```
Ensure your `DATABASE_URL` points to your PostgreSQL instance. *(See Section 3 for the environment variable dictionary).*

### Step 3: Backend Setup & Database Push
```bash
cd backend
npm install

# Push the Prisma schema directly to your PostgreSQL database
npx prisma db push

# Seed realistic factory data (14 calibrated orders, TNA milestones, shift logs, photos, audit events)
npm run seed:calibrated

# Start the backend development server (runs on http://localhost:4000)
npm run dev
```

### Step 4: Frontend Setup
In a separate terminal:
```bash
cd frontend
npm install

# Start the Vite development server (runs on http://localhost:5173)
npm run dev
```
Open `http://localhost:5173` in your browser to access the application.

### Step 5: Run Automated Verification Tests
ThreadFlow includes an automated test suite verifying all 4 core business logic engines:
```bash
npm --prefix backend test
```
* **Feature 5 (Show-Your-Math Risk Engine):** 34 tests passing (Sunday exclusions, 3-day weighted moving average, knitwear buffers, financial exposure).
* **Feature 9 (Resilient Tamil AI Pipeline):** 35 tests passing (Gemini API classification, SLA timeout racing, deterministic regex fallback).
* **Feature 3 & 4 (Orders & TNA Pipeline):** 32 tests passing (7-stage sequential milestones, size breakdowns, optimistic locking, audit chaining).
* **Feature 8 (Production Ingestion & Invariants):** 27 tests passing (anti-finger-slip sequence checks, 3% fabric tolerance ceiling, UUID idempotency).
* **Total: 128 tests passing (100% pass rate).**

---

## 2. Production Cloud Deployment: Render & Docker

ThreadFlow is designed to deploy seamlessly either **natively on Render (Recommended for zero-friction setup)** or via **Docker / Docker Compose**.

### Option A: Render Cloud Deployment (Native — No Docker Required)

Render natively supports full-stack Node.js environments and static SPAs without needing Docker locally:

#### 1. Backend Web Service (Render Web Service)
* **Environment:** `Node`
* **Root Directory:** `backend`
* **Build Command:** `npm install && npx prisma db push && npm run build`
* **Start Command:** `npm start`
* **Environment Variables:** Set the environment variables listed in Section 3 (e.g. `DATABASE_URL`, `JWT_ACCESS_SECRET`, `SENDGRID_API_KEY`, `APP_ORIGIN`).

#### 2. Frontend Web Service (Render Static Site)
* **Environment:** `Static Site`
* **Root Directory:** `frontend`
* **Build Command:** `npm install && npm run build`
* **Publish Directory:** `dist`
* **Rewrite Rule:** Add rewrite rule for client-side SPA routing:
  * Source: `/*` $\to$ Destination: `/index.html` (Action: `Rewrite`)
* **Environment Variable:** `VITE_API_URL=https://your-backend.onrender.com/api/v1`

---

### Option B: Containerized Deployment via Docker & Docker Compose

For local or VPS deployments using Docker:

```bash
# From the project root
docker-compose up -d --build
```

### Services Orchestrated
| Service | Image / Build Context | Port | Description |
| :--- | :--- | :---: | :--- |
| **`threadflow-backend`** | `./backend/Dockerfile` (Node 20 Alpine) | `4000` | Express REST API, Prisma ORM, Gemini AI bridge, PDF report generator |
| **`threadflow-frontend`** | `./frontend/Dockerfile` (Nginx Alpine) | `80`, `5173` | React SPA production build with client-side SPA routing and `/api/v1` reverse proxy |

---

## 3. Environment Variable Dictionary (Names Only — No Secrets)

As required by the client brief, this table documents the required environment variables with names and descriptions only. Real secret values must be supplied via your secure deployment environment.

| Variable Name | Required | Default / Format | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `4000` | Port for the backend Express server |
| `NODE_ENV` | Required | `development` / `production` | Node runtime environment mode |
| `APP_ORIGIN` | Required | URL (e.g. `http://localhost:5173`) | Allowed CORS origin for frontend client requests |
| `API_PREFIX` | Optional | `/api/v1` | URL routing prefix for all REST endpoints |
| `DATABASE_URL` | **Required** | `postgresql://user:pass@host:port/db?sslmode=require` | PostgreSQL connection pooler URL (IPv4-compatible) for backend queries |
| `DIRECT_URL` | **Required** | `postgresql://user:pass@host:5432/db` | Direct PostgreSQL connection URL for Prisma migrations and schema push |
| `JWT_ACCESS_SECRET` | **Required** | 64-char hex string | Secret key for signing 15-minute access tokens |
| `JWT_ACCESS_EXPIRY` | Optional | `15m` | Lifetime of the short-lived JWT access token |
| `JWT_REFRESH_SECRET` | **Required** | 64-char hex string | Secret key for signing 7-day HttpOnly refresh cookies |
| `JWT_REFRESH_EXPIRY` | Optional | `7d` | Lifetime of the refresh token session |
| `ENCRYPTION_MASTER_KEY` | **Required** | 64-char hex string | AES-256-GCM master key for cryptographic audit log sealing |
| `SIMULATED_TODAY_DATE` | Optional | `2026-11-02` | Calibrated anchor date matching the client problem statement |
| `AI_PROVIDER` | Optional | `gemini` | AI provider identifier (`gemini` or `local_fallback`) |
| `AI_MODEL` | Optional | `gemini-3.1-flash-lite` | Google Gemini model name for speech transcription and classification |
| `AI_API_KEY` | Optional | Google Gemini API Key | API key for Gemini AI. *(If omitted, the app automatically uses the built-in deterministic Tiruppur textile regex fallback dictionary).* |
| `AI_TIMEOUT_MS` | Optional | `3000` | SLA timeout in milliseconds before engaging instant local fallback |
| `AI_CONFIDENCE_THRESHOLD` | Optional | `0.65` | Minimum AI confidence score before flagging for merchandiser review |
| `SENDGRID_API_KEY` | Optional | SendGrid API key (`SG...`) | API key for automated password recovery OTP emails and notifications |
| `SENDGRID_FROM_EMAIL` | Optional | Verified Sender Email | Verified sender address for transactional OTP emails |

---

## 4. Reviewer Pre-Configured Demo Accounts

All accounts use default password: `ThreadFlow@2026`

| Role | Username / Email | Password | Primary Reviewer Workflows to Test |
| :--- | :--- | :--- | :--- |
| **Senior Merchandiser** | `merchandiser@company-a.com` | `ThreadFlow@2026` | Factory Order Board (Green/Amber/Red cards), Order & TNA Setup, "Show-Your-Math" run-rate breakdown, AI Issue Review & Confirmation Gate, What-If Recovery Simulator, and Weekly PDF Report Export. |
| **Floor Supervisor (Unit 1)** | `supervisor.muthu@company-a.com` | `ThreadFlow@2026` | Mobile-optimized shop floor view, stage output entry, Tamil/Hindi/English voice input via Web Speech API, photo proof capture, and offline IndexedDB sync. |
| **Floor Supervisor (Unit 2)** | `supervisor.selvam@company-a.com` | `ThreadFlow@2026` | Mobile floor workspace for Unit 2 & 3 stitching lines. |
| **UK Foreign Buyer** | `sourcing@company-b.co.uk` | `ThreadFlow@2026` | Scoped Buyer Portal viewing POs `B-PO-88213` and `B-PO-88240`, confirmed photos, milestones, and weekly reports with zero access to other brands' data. |
| **German Foreign Buyer** | `compliance@company-c.de` | `ThreadFlow@2026` | Scoped Buyer Portal viewing PO `C-PO-0488` with verified multi-tenant isolation. |
| **System Administrator** | `admin@threadflow.com` | `ThreadFlow@2026` | Global administrative oversight across all manufacturing units, orders, audit logs, and system settings. |
| **System Administrator (Alt)** | `agniva.sardar@gmail.com` | `ThreadFlow@2026` | Second Administrator account for testing email OTP password resets and administrative control. |

---

## 5. Reviewer Recommended 5-Minute Tour

1. **Sign in as Merchandiser (`merchandiser@company-a.com`)**:
   - Inspect the **Orders** board showing calibrated orders (`B-PO-88240` Red, `C-PO-0488` Amber, `B-PO-88213` Green).
   - Go to **Risk & Capacity** and click **"Show Your Math"** on `B-PO-88240` to see the live run-rate calculation ($311\text{ req vs }200\text{ actual pcs/day} \implies 5\text{ days late} \implies \text{₹3.5 Lakh air freight risk}$).
   - Test the interactive **"What-If" Recovery Simulator** to evaluate adding stitching lines or overtime.
   - Go to **Reports** and click **"Export Weekly PDF Report"** to view the formal branded sourcing report with 5-week TNA multi-bar trends.
2. **Sign in as Floor Supervisor (`supervisor.muthu@company-a.com`)**:
   - Experience the mobile floor layout. Click **"Log Shift Output"** on an active order.
   - Switch language to **தமிழ் (Tamil)** and click the **Microphone** to speak (e.g. *"200 பீஸ் முடிந்தது, 5 ரிஜெக்ட், மெஷின் பிரேக் டவுன்"*).
   - Observe real-time speech transcription and automatic extraction of good pieces (+200), rejects (5), and root-cause (`MACHINE_BREAKDOWN`).
3. **Sign in as Foreign Buyer (`sourcing@company-b.co.uk`)**:
   - Verify that the UK buyer sees only Company B purchase orders with confirmed photos and milestones, with zero access to Company C styles or volumes.
4. **Sign in as System Admin (`admin@threadflow.com`)**:
   - Navigate to **Audit** to inspect the immutable date-change compliance ledger with SHA-256 Merkle hash chain protection.
