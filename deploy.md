# ThreadFlow — Deployment & Operations Guide (`deployment.md` / `deploy.md`)

**ThreadFlow** is an offline-resilient Knitwear Production Tracking & Intelligence Operating System engineered for export apparel manufacturers in Tiruppur, Tamil Nadu.

This document serves as the authoritative operational manual for reviewers and technical evaluators.

---

## 0. Official Project URLs

| Resource | Link |
| :--- | :--- |
| **Live Production Frontend (Web / Mobile PWA)** | **[https://threadflow-ptun.onrender.com](https://threadflow-ptun.onrender.com)** |
| **Live Production Backend API Service** | **[https://threadflow-backend-z7s9.onrender.com](https://threadflow-backend-z7s9.onrender.com)** |
| **Backend API Health Check Endpoint** | [https://threadflow-backend-z7s9.onrender.com/api/v1/health](https://threadflow-backend-z7s9.onrender.com/api/v1/health) |
| **GitHub Repository** | [https://github.com/AgnivaSardar/ThreadFlow](https://github.com/AgnivaSardar/ThreadFlow) |
| **Managed Cloud Database** | Supabase PostgreSQL 16 (AWS Asia-Pacific `ap-south-1` Connection Pooled) |
| **Technical Design Document (PDF)** | [`submission/Technical_Design_Document.pdf`](submission/Technical_Design_Document.pdf) |
| **Technical Design Document (Word .docx)** | [`submission/Technical_Design_Document.docx`](submission/Technical_Design_Document.docx) |

---

## 1. Reviewer Demo Login Credentials

> **Quick Evaluation:** You can immediately test the live application at **[https://threadflow-ptun.onrender.com](https://threadflow-ptun.onrender.com)** without any local installation.

**Default Password for ALL Accounts:** `ThreadFlow@2026`

| Role | Name | Login Email | Password | Unit / Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Merchandiser** | Ramesh Merchandiser | `merchandiser@company-a.com` | `ThreadFlow@2026` | Factory-Wide (All Units) |
| **Supervisor (Unit 1)** | Muthu Floor Supervisor | `supervisor.muthu@company-a.com` | `ThreadFlow@2026` | Unit 1 (Cotton Hub - 5 POs) |
| **Supervisor (Unit 1 Co-Lead)** | Kumaravel Shift In-Charge | `supervisor.kumar@company-a.com` | `ThreadFlow@2026` | Unit 1 (Cotton Hub - 5 POs) |
| **Supervisor (Unit 2)** | Selvam Floor Supervisor | `supervisor.selvam@company-a.com` | `ThreadFlow@2026` | Unit 2 (Stitching Hub - 4 POs) |
| **Supervisor (Unit 2 Co-Lead)** | Manickam Floor Supervisor | `supervisor.manickam@company-a.com` | `ThreadFlow@2026` | Unit 2 (Stitching Hub - 4 POs) |
| **Supervisor (Unit 3)** | Murugan Floor Supervisor | `supervisor.murugan@company-a.com` | `ThreadFlow@2026` | Unit 3 (Specialty - 1 PO) |
| **Buyer (UK)** | Sarah Jenkins | `buyer@company-b.co.uk` | `ThreadFlow@2026` | Company B Only |
| **Buyer (Germany)** | Klaus Mueller | `compliance@company-c.de` | `ThreadFlow@2026` | Company C Only |
| **Managing Director / Admin** | Agniva Sardar / Ops Admin | `agniva.sardar@gmail.com` | `ThreadFlow@2026` | Factory Administration |
| **System Administrator** | System Administrator | `admin@threadflow.com` | `ThreadFlow@2026` | System Administration |

### Key Workflows to Test by Role

* **Senior Merchandiser (`merchandiser@company-a.com`)**:
  * Factory Order Board with Green/Amber/Red status cards.
  * Filters for Buyer, Manufacturing Unit, and ISO Ship Week.
  * Transparent **"Show-Your-Math"** run-rate calculation ($311\text{ req vs }200\text{ actual} \implies 5\text{ days late} \implies \text{₹3.5 Lakh air freight risk}$).
  * **AI Issue Review & Confirmation Gate** (approve/override Tamil classified issues before they reach buyer eyes).
  * Interactive **"What-If" Capacity Simulator** (add stitching lines to flip orders from Red to Green).
  * Weekly branded multi-bar TNA progress PDF report export.
* **Floor Supervisor (`supervisor.muthu@company-a.com` or `supervisor.kumar@company-a.com`)**:
  * Mobile floor view strictly scoped to Unit 1 products (5 POs: `B-PO-88240`, `B-PO-88213`, `IND-PO-77401`, `B-PO-88255`, `NEXT-PO-33104`).
  * Demonstrates that **multiple supervisors under one unit** share all products of that unit identically.
  * Shift quantity logging with per-size breakdowns.
  * **Tamil voice dictation** (`ta-IN`) via Web Speech API with real-time root-cause category extraction.
  * Inspection photo capture and offline **IndexedDB** submission queue.
* **Foreign Buyers (`buyer@company-b.co.uk` / `compliance@company-c.de`)**:
  * Scoped Buyer Portal showing only their own orders (`B-PO-88213`, `B-PO-88240` for Company B).
  * Confirmed milestones and merchandiser-approved factory photos.
  * **Zero data leakage:** Company C styles, quantities, and mill issues are completely invisible.
* **Managing Director / Admin (`admin@threadflow.com` / `agniva.sardar@gmail.com`)**:
  * Complete operational oversight across all 6 manufacturing units.
  * Immutable compliance audit trail protected by cryptographic SHA-256 Merkle hash chain.

---

## 2. Guided 5-Minute Evaluator Tour

```
+-----------------------------------------------------------------------------------------+
|                                5-MINUTE EVALUATION TOUR                                 |
+-----------------------------------------------------------------------------------------+
| 1. Merchandiser Board   --> View Green/Amber/Red Cards & Run-Rate "Show Your Math"     |
| 2. Mobile Floor Entry   --> Speak Tamil Voice Dictation & Capture Defect Photo           |
| 3. Merchandiser Gate    --> Review & Approve Tamil AI Classification Before Buyer Eyes  |
| 4. Scoped Buyer Portal  --> Verify Zero Data Leakage Between Company B and Company C    |
| 5. Compliance Audit     --> Inspect SHA-256 Merkle Ledger of Every Date Modification    |
+-----------------------------------------------------------------------------------------+
```

### Tour Step 1: Merchandiser Order Board & "Show-Your-Math" Engine
1. Navigate to: **[https://threadflow-ptun.onrender.com](https://threadflow-ptun.onrender.com)**
2. Sign in as **Merchandiser**:
   * **Email:** `merchandiser@company-a.com` | **Password:** `ThreadFlow@2026`
3. Inspect the **Order Board**:
   * View live status cards: **Green (On Track)**, **Amber (Minor Buffer Consumed)**, and **Red (Critical Deficit)**.
   * Filter by **Buyer** (`Company B (UK)`), **Unit** (`Unit 1`), or **Ship Week**.
4. Open Order **`B-PO-88240` (Men's Polo White — 8,000 pcs)**:
   * Click **"Show Your Math"**: View the exact arithmetic run-rate breakdown.
   * Notice: Remaining Quantity ($2,800\text{ pcs}$), Effective Working Days ($9\text{ days}$ after $14\text{ downstream buffer days}$), Required Daily Rate ($311\text{ pcs/day}$), vs Actual 3-Day Rolling Average ($200\text{ pcs/day}$).
   * Projected Delay: **5 Days Late**, triggering a **₹3.5 Lakh Air Freight Risk** flag 14 days in advance!
5. Test the **"What-If" Recovery Simulator**:
   * Simulate adding **1 additional stitching line** (+250 pcs/day capacity).
   * Notice the status flip from **Red to Green**, saving the shipment without expensive air freight.

### Tour Step 2: Floor Supervisor Mobile Experience & Tamil Voice Dictation
1. Open an Incognito window (or switch browser) to simulate a supervisor's phone.
2. Sign in as **Unit 1 Supervisor**:
   * **Email:** `supervisor.muthu@company-a.com` | **Password:** `ThreadFlow@2026`
3. Notice that Muthu sees **all 5 products handled by Unit 1** (and *only* Unit 1 products).
4. Tap **"Log Shift Output"** on an active milestone:
   * Switch interface language to **தமிழ் (Tamil)** using the header toggle.
   * Click the **Microphone icon** and speak (or type):
     > *"400 பீஸ் முடிந்தது 10 ரிஜெக்ட் மெஷின் பிரேக் டவுன்"*
     *(or in English: "400 pieces finished 10 reject machine breakdown")*
   * Tap the **Camera icon** to attach an inspection photo.
   * AI extracts: Good = 400, Rejects = 10, Reason = `MACHINE_BREAKDOWN`.
5. Tap **"Submit Shift Output"**.

### Tour Step 3: Merchandiser AI Review Gate
1. Switch back to the **Merchandiser** session (`merchandiser@company-a.com`).
2. Navigate to **"AI Issue Review"**:
   * View the supervisor's submitted floor note.
   * Notice the original Tamil transcript sits alongside the clean English summary.
   * Merchandisers have full authority to override the category or approve it.
   * **Crucial Constraint:** Unapproved warnings and floor photos never reach the buyer portal until confirmed by the merchandiser.
3. Click **"Approve for Buyer Portal"**.

### Tour Step 4: Multi-Tenant Scoped Buyer Portal
1. Sign in as the **UK foreign buyer**:
   * **Email:** `buyer@company-b.co.uk` | **Password:** `ThreadFlow@2026`
2. Notice the clean, minimalist buyer interface:
   * The buyer sees **only Company B purchase orders** (`B-PO-88213`, `B-PO-88240`).
   * They see completed milestones, approved inspection photos, and live progress bars.
   * **Strict Isolation:** Company C's styles, quantities, and internal factory delays are completely invisible.
3. Click **"Download Weekly Status Export (PDF)"** to generate the branded weekly status sheet.

### Tour Step 5: Compliance Audit Trail
1. Sign in as **Admin / Managing Director**:
   * **Email:** `admin@threadflow.com` (or `agniva.sardar@gmail.com`) | **Password:** `ThreadFlow@2026`
2. Navigate to **Audit Logs**:
   * Review the chronological ledger recording every milestone date shift, reason code, author identity, and timestamp.
   * Each entry features a cryptographic SHA-256 hash chaining back to the previous transaction, ensuring complete compliance audit integrity.

---

## 3. How to Run It Locally (Step by Step)

### 3.1 Prerequisites
Before starting, ensure your local workstation has the following tools installed:
* **Node.js**: `v20.17.0` LTS or newer (verified on Node 20.x and 22.x)
* **npm**: `v10.x` or newer
* **PostgreSQL Database**: PostgreSQL 16 (local server, Docker container, or cloud PostgreSQL instance such as Supabase, Neon, or AWS RDS)
* **Git**: `v2.30+`

---

### 3.2 Step 1: Clone the Repository
Clone the codebase from GitHub and enter the root workspace:
```bash
git clone https://github.com/AgnivaSardar/ThreadFlow.git
cd ThreadFlow
```

---

### 3.3 Step 2: Configure Environment Variables
Copy the provided `.env.example` templates into the root and backend directories:

```bash
# On Windows PowerShell
Copy-Item .env.example .env
Copy-Item .env.example backend/.env

# On Linux / macOS / Git Bash
cp .env.example .env
cp .env.example backend/.env
```

Open `backend/.env` in your code editor and provide your PostgreSQL database connection strings for `DATABASE_URL` and `DIRECT_URL`. *(Refer to Section 5 for the complete variable dictionary).*

---

### 3.4 Step 3: Backend Setup & Database Initialization
Open a terminal in the `backend/` directory:

```bash
cd backend

# 1. Install backend dependencies
npm install

# 2. Generate Prisma Client bindings
npx prisma generate

# 3. Synchronize database schema directly to PostgreSQL
npx prisma db push

# 4. Seed calibrated problem-statement data (14 calibrated export orders, milestones, supervisors, shift logs, photos)
npm run seed:calibrated

# 5. Start the backend development server
npm run dev
```
* The backend API server starts with hot-reloading at **`http://localhost:4000`**.
* Verify API status by visiting **`http://localhost:4000/api/v1/health`** in your browser.

---

### 3.5 Step 4: Frontend Setup & Launch
Open a second terminal window in the `frontend/` directory:

```bash
cd frontend

# 1. Install frontend dependencies
npm install

# 2. Start Vite development server
npm run dev
```
* The Vite frontend client launches at **`http://localhost:5173`**.
* Open **`http://localhost:5173`** in your desktop or mobile browser.

---

### 3.6 Step 5: Run Automated Verification Tests
ThreadFlow includes an end-to-end automated test suite covering all four core domain engines:

```bash
# Run the complete test suite from the repository root
npm --prefix backend test
```

#### Test Suite Breakdown (128 Tests — 100% Passing):
1. **Mathematical Run-Rate Risk Engine (`tests/risk.test.ts` — 34 Tests):**
   * Sunday calendar exclusion logic.
   * 3-day weighted moving average ($0.50 \cdot Q_t + 0.30 \cdot Q_{t-1} + 0.20 \cdot Q_{t-2}$) and auto-normalization for single-shift records.
   * Downstream knitwear buffer preservation (14 to 18 buffer days across Checking, Finishing, and Internal Audit).
   * Exact air-freight (₹3.5 Lakh) and 5% client discount financial penalty calculations.
2. **Resilient AI Classification & Regex Fallback (`tests/ai.fallback.test.ts` — 35 Tests):**
   * Google Gemini API JSON schema contract validation.
   * 3,000ms SLA timeout racing and graceful fallback activation.
   * Deterministic regex dictionary matching colloquial Tiruppur Tamil terms (*"கரண்ட் கட்"*, *"மெஷின் பிரேக் டவுன்"*, *"ஆட்கள் வரவில்லை"*).
3. **Orders & TNA Critical Path Engine (`tests/orders.test.ts` — 32 Tests):**
   * 7-stage sequential milestone creation and date calculation from order start date to ex-factory date.
   * Color/size matrix quantity validation against purchase order total.
   * Optimistic locking and SHA-256 tamper-evident compliance audit chaining.
4. **Production Ingestion Invariants (`tests/production.test.ts` — 27 Tests):**
   * Unit-scoped work order retrieval (5 orders for Unit 1, 4 for Unit 2, 1 for Unit 3).
   * Anti-finger-slip checks preventing completed stage output from exceeding previous stage actuals.
   * 3% fabric overage tolerance ceiling enforcement.
   * RFC 4122 UUIDv4 idempotency deduplication for offline edge retries.

---

### 3.7 Step 6: Testing Mobile PWA & Offline Queuing Locally
1. In Google Chrome, press `F12` to open Developer Tools and toggle the **Device Toolbar** (`Ctrl+Shift+M`) to simulate a mobile phone (e.g., Pixel 7 or Galaxy S20).
2. Sign in as Floor Supervisor (`supervisor.muthu@company-a.com`).
3. Switch Chrome's Network tab to **"Offline"**.
4. Log a shift quantity with voice or text and tap **"Submit Shift Output"**.
5. Notice that the update queues seamlessly in the browser's local **IndexedDB** queue with status indicator **"Queued Offline"**.
6. Switch Network back to **"Online"**; the edge sync worker automatically flushes the queue with zero double-counting via idempotency keys.

---

## 4. How It Is Deployed

ThreadFlow follows a decoupled cloud deployment topology designed for zero hosting friction, high reliability, and low operational overhead.

```
                    +------------------------------------------+
                    |             USER CHANNELS                |
                    |  Merchandisers | Supervisors | Buyers    |
                    +--------------------+---------------------+
                                         | HTTPS
                                         v
+----------------------------------------------------------------------------------+
| FRONTEND: Render Static Site (https://threadflow-ptun.onrender.com)             |
| - Built React 18 SPA bundle (HTML5, Tailwind CSS, Lucide icons)                 |
| - SPA Rewrite Rule: /* -> /index.html                                            |
| - Edge Storage: IndexedDB offline shift queue + Web Speech API (ta-IN)           |
+----------------------------------------+-----------------------------------------+
                                         | HTTPS REST API (VITE_API_URL)
                                         v
+----------------------------------------------------------------------------------+
| BACKEND: Render Node Web Service (https://threadflow-backend-z7s9.onrender.com)  |
| - Node.js 20 + Express Modular Monolith API (/api/v1)                            |
| - JWT Auth & Scoped Multi-Tenant RBAC Middleware                                 |
| - Business Engines: Risk Engine, Review Gate, Invariant Guard, Exports           |
| - Prisma ORM 5.22 with pooled database client                                    |
+-------------------+--------------------+--------------------+--------------------+
                    |                    |                    |
                    v                    v                    v
+-----------------------+ +--------------------+ +--------------------+
| DATABASE: Supabase    | | AI: Google Gemini  | | NOTIFICATIONS:     |
| Managed PostgreSQL 16 | | 3.1 Flash Lite API | | SendGrid API &     |
| Port 6543 (Pooled)    | | (Tamil Note Class- | | WhatsApp wa.me     |
| Port 5432 (Direct)    | | ifier + Fallback)  | | Deep Links         |
+-----------------------+ +--------------------+ +--------------------+
```

### 4.1 Backend Deployment (Render Node Web Service)
* **Platform:** Render (`https://dashboard.render.com`)
* **Service Type:** Web Service
* **Environment:** `Node` (Runtime Node.js 20.x)
* **Root Directory:** `backend`
* **Build Command:**
  ```bash
  npm install && npx prisma generate && npx prisma db push && npm run build
  ```
* **Start Command:**
  ```bash
  npm start
  ```
* **Health Check Path:** `/api/v1/health`
* **Auto-Deploy:** Enabled on Git push to branch `main`.

### 4.2 Frontend Deployment (Render Static Site)
* **Platform:** Render Static Site
* **Root Directory:** `frontend`
* **Build Command:**
  ```bash
  npm install && npm run build
  ```
* **Publish Directory:** `dist`
* **SPA Client-Side Routing Rewrite Rule:**
  * **Source:** `/*`
  * **Destination:** `/index.html`
  * **Action:** `Rewrite`
* **Environment Variable:** `VITE_API_URL` pointing to the deployed backend URL.

### 4.3 Cloud Database Deployment (Supabase PostgreSQL 16)
* **Engine:** PostgreSQL 16 hosted on Supabase (AWS `ap-south-1` Mumbai region for minimal latency to Tiruppur).
* **Connection Pooling:** Connected through Supavisor connection pooler on port `6543` with `sslmode=require` to prevent database connection exhaustion during high-concurrency supervisor shifts.
* **Direct Migration Connection:** Port `5432` for Prisma schema push operations.

---

## 5. Environment Variable Specification (Names Only — Zero Secrets)

In accordance with strict application security standards and the client problem specification, **only variable names, types, and operational descriptions are listed below. Secret values, credentials, and cryptographic keys are omitted.**

### 5.1 Backend Service Environment Variables (`backend/.env`)

| Variable Name | Required | Type / Format | Purpose & Functional Scope |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | Integer (e.g. `4000`) | Network port on which the Express HTTP server listens. Render sets this dynamically. |
| `NODE_ENV` | **Required** | `production` \| `development` | Dictates runtime mode, cookie security attributes (`secure`, `sameSite`), and error verbosity. |
| `APP_ORIGIN` | **Required** | Origin URL | Frontend origin URL allowed by backend CORS middleware to prevent unauthorized cross-origin requests. |
| `API_PREFIX` | Optional | Path Prefix (e.g. `/api/v1`) | Base routing prefix for all REST API endpoints. |
| `DATABASE_URL` | **Required** | PostgreSQL Connection URI | Transaction-pooled PostgreSQL URI (`port 6543`) used by Prisma Client for all application queries. |
| `DIRECT_URL` | **Required** | PostgreSQL Connection URI | Non-pooled direct PostgreSQL URI (`port 5432`) required by Prisma for schema migrations and introspection. |
| `JWT_ACCESS_SECRET` | **Required** | High-entropy String (HMAC) | Secret key used to sign and verify short-lived 15-minute access JWTs. |
| `JWT_ACCESS_EXPIRY` | Optional | Duration (e.g. `15m`) | Configures lifespan of the access token before silent refresh is required. |
| `JWT_REFRESH_SECRET` | **Required** | High-entropy String (HMAC) | Secret key used to sign 7-day HttpOnly refresh cookies stored in the client browser. |
| `JWT_REFRESH_EXPIRY` | Optional | Duration (e.g. `7d`) | Configures validity period of the persistent session token. |
| `ENCRYPTION_MASTER_KEY` | **Required** | 32-byte / 64-char Hex String | Master key used for AES-256-GCM cryptographic hashing of immutable audit log entries. |
| `SIMULATED_TODAY_DATE` | Optional | ISO Date (`YYYY-MM-DD`) | Anchor date for run-rate risk engine calculations, calibrated to problem statement data (`2026-11-02`). |
| `AI_PROVIDER` | Optional | `gemini` \| `local_fallback` | Selects primary natural language processing provider for Tamil floor note translation and categorization. |
| `AI_MODEL` | Optional | Model Identifier String | Google Gemini model identifier (`gemini-3.1-flash-lite` or `gemini-1.5-flash`). |
| `AI_API_KEY` | Optional | Vendor API Key String | Authentication key for Google Gemini API. *If omitted or exhausted, system seamlessly activates local regex fallback.* |
| `AI_TIMEOUT_MS` | Optional | Milliseconds (e.g. `3000`) | Hard SLA race timeout. If Gemini takes longer than this duration, local fallback answers immediately. |
| `AI_CONFIDENCE_THRESHOLD` | Optional | Float `0.0` - `1.0` (e.g. `0.65`) | Minimum confidence score below which an AI classification is automatically flagged for human review. |
| `SENDGRID_API_KEY` | Optional | SendGrid Key (`SG...`) | API key for dispatching transactional email OTPs for password recovery. |
| `SENDGRID_FROM_EMAIL` | Optional | Verified Email Address | Verified sender email address displayed on outgoing password reset emails. |

### 5.2 Frontend Client Environment Variables (`frontend/.env`)

| Variable Name | Required | Type / Format | Purpose & Functional Scope |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Required** | Full HTTP(S) URL | Base URL of the backend REST service used by the frontend Axios client (e.g. `https://threadflow-backend-z7s9.onrender.com/api/v1`). |

---

## 6. Support & Maintenance Contact

* **Lead Engineer:** Agniva Sardar
* **Repository:** [https://github.com/AgnivaSardar/ThreadFlow](https://github.com/AgnivaSardar/ThreadFlow)
* **Production Frontend:** [https://threadflow-ptun.onrender.com](https://threadflow-ptun.onrender.com)
* **Production Backend:** [https://threadflow-backend-z7s9.onrender.com](https://threadflow-backend-z7s9.onrender.com)
