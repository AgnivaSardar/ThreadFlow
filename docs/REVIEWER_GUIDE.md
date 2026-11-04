# Reviewer Evaluation Guide & Submission Blueprint

This guide maps the **ThreadFlow** implementation directly to the reviewer evaluation criteria and client problem statement requirements.

---

## 1. Submission Deliverables Mapping

| Required Deliverable | Repository Location | Summary |
| :--- | :--- | :--- |
| **Technical Design Document (TDD)** | [`TECHNICAL_DESIGN_DOCUMENT.md`](../TECHNICAL_DESIGN_DOCUMENT.md) | Comprehensive 34 KB design document detailing the ₹1.08 Cr loss analysis, Modular Monolith architecture, relational invariants, "Show-Your-Math" run-rate formulas, Tamil AI classifier, offline IndexedDB sync, and trade-offs. |
| **Deployment Runbook** | [`docs/DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md) | Step-by-step local setup, Docker Compose orchestration, Supabase PostgreSQL pooler configuration, health checks, and test runner. |
| **API & Data Specification** | [`docs/API_AND_DATA_SPECIFICATION.md`](API_AND_DATA_SPECIFICATION.md) | Relational schema, 7-stage knitwear buffer schedule, REST API contracts (`/api/v1`), RBAC security matrix, and UI design tokens. |
| **Problem Statement & Scope** | [`docs/PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) | Verbatim client brief, ₹1.08 Crore loss quantification, and calibrated baseline orders (`2026-11-02`). |

---

## 2. Reviewer Pre-Configured Demo Accounts

All demo accounts use password: `ThreadFlow@2026`

| Role | Username / Email | Password | Primary Reviewer Workflows to Test |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@threadflow.com` | `ThreadFlow@2026` | Global administrative access across all factory units, orders, audit logs, and system settings. |
| **Senior Merchandiser** | `merchandiser@company-a.com` | `ThreadFlow@2026` | Factory Order Board (Green/Amber/Red), Order & TNA Setup, "Show-Your-Math" run-rate details, AI Issue Review & Confirmation Gate, What-If Recovery Simulator, Weekly Buyer PDF/Excel Export. |
| **Floor Supervisor (Unit 1)** | `supervisor.muthu@company-a.com` | `ThreadFlow@2026` | Mobile-optimized shop floor view, stage output entry, Tamil/Hindi/English voice input with Web Speech API, photo capture, offline sync queue. |
| **Floor Supervisor (Unit 2)** | `supervisor.selvam@company-a.com` | `ThreadFlow@2026` | Unit 2 & 3 stitching lines. |
| **Buyer (Company B - UK)** | `sourcing@company-b.co.uk` | `ThreadFlow@2026` | Scoped Buyer Portal (`B-PO-88213`, `B-PO-88240`), only merchandiser-confirmed warnings and photos, zero access to Company C orders (HTTP 404 isolation). |
| **Buyer (Company C - DE)** | `compliance@company-c.de` | `ThreadFlow@2026` | Scoped Buyer Portal (`C-PO-0488`), verified tenant boundary checks. |

---

## 3. Step-by-Step Reviewer Evaluation Walkthrough

### Flow 1: Merchandiser Command Center & Risk Math
1. Sign in as `merchandiser@company-a.com` / `ThreadFlow@2026`.
2. Navigate to **Orders**:
   - Inspect the factory order board with calibrated orders (`B-PO-88240` Red, `C-PO-0488` Amber, `B-PO-88213` Green).
   - Click order `B-PO-88240` to view the 7-stage TNA critical path, size breakdown (`S`, `M`, `L`, `XL`), and change history table with pagination.
3. Navigate to **Risk & Capacity**:
   - Click **"Show Your Math"** on `B-PO-88240` to inspect the live formula:
     $$\text{Required Rate} = \frac{\text{Remaining Pcs}}{\text{Working Days Left (Sundays Excluded)}} = \frac{2,800}{9} = 311\text{ pcs/day}$$
     $$\text{Actual Rolling Rate (3-Day WMA)} = 0.50(200) + 0.30(200) + 0.20(200) = 200\text{ pcs/day}$$
     $$\text{Deficit} = -111\text{ pcs/day} \implies 5\text{ Days Late} \implies \text{₹3.5 Lakh Air Freight Risk}$$
   - Launch the interactive **"What-If" Simulator** to test adding a stitching line or authorizing overtime to recover the schedule.
4. Navigate to **Reports**:
   - Click **"Export Weekly PDF Report"** to view the generated branded sourcing report with letterhead, AI summary, and 5-week TNA multi-bar comparison.

### Flow 2: Floor Supervisor Mobile Experience & Tamil Voice
1. Sign in as `supervisor.muthu@company-a.com` / `ThreadFlow@2026`.
2. Notice the mobile-friendly layout and Unit 1 active work queue.
3. Select an active order and click **"Log Shift Output"**:
   - Select Language: **தமிழ் (Tamil)**, **English**, or **हिंदी (Hindi)**.
   - Click the **Microphone** button and speak in Tamil (e.g. *"200 பீஸ் முடிந்தது, 5 ரிஜெக்ட், மெஷின் பிரேக் டவுன்"*).
   - Observe real-time speech transcription and automatic extraction of good quantity (+200), rejects (5), and issue category (`MACHINE_BREAKDOWN`).
   - Attach a defect proof photo and submit.

### Flow 3: Foreign Buyer Isolation Gate
1. Sign in as UK buyer `sourcing@company-b.co.uk` / `ThreadFlow@2026`.
2. Observe the strictly isolated Buyer Portal showing only Company B purchase orders (`B-PO-88213`, `B-PO-88240`).
3. Notice that internal factory remarks and unconfirmed issues are hidden. Only verified milestone completions and merchandiser-confirmed defect proofs appear.
4. Try to navigate to Company C's order `/orders/[company-c-id]` — observe immediate HTTP 404 / access denial.

### Flow 4: Compliance Audit Trail
1. Sign in as `admin@threadflow.com` / `ThreadFlow@2026`.
2. Navigate to **Audit**:
   - View the immutable ledger of all critical schedule shifts and output logs.
   - Note the mandatory reason codes (`FABRIC_DELAY`, `LABOUR_SHORTAGE`, etc.) and diff snapshots.
   - Verify the continuous SHA-256 cryptographic `auditHash` Merkle chain protecting the record from tampering.

---

## 4. Reviewer Scoring Breakdown & Implementation Coverage

### Area 1: Quality of Work (50% Weight)
* **ACID Relational Model:** PostgreSQL 16 on Supabase with foreign keys, cascading rules, unique constraints (`idempotencyKey`, `[orderId, size, color]`), and explicit indexing.
* **Architecture:** Clean Modular Monolith in TypeScript with strict boundaries (Auth, Orders, Production, Risk, AI, Buyer Portal, Audit, Reports).
* **Dual-Persona Interface:**
  * Desktop command center for Merchandisers with high data density.
  * Mobile-optimized high-contrast UI for Factory Floor Supervisors (minimum 54px touch targets).
* **Security & Multi-Tenant Isolation:**
  * JWT access & HttpOnly refresh token rotation.
  * Database queries strictly scoped to `req.user.buyerId` for buyer routes.

### Area 2: Problem Solving (30% Weight)
* **Deterministic Run-Rate Engine:**
  * Excludes non-working Sundays in calendar calculations.
  * Incorporates 3-day weighted moving average ($0.50 / 0.30 / 0.20$) to smooth single-day noise.
  * Enforces Tiruppur knitwear downstream stage buffers (18d knitting down to 0d finishing).
  * Direct financial exposure calculation (₹1,05,000 late penalty or ₹3,50,000 air freight escalation).
* **AI Resilience & Human Gate:**
  * Tamil/Tanglish semantic classification using Gemini 3.1 Flash Lite.
  * Instant fallback to an embedded local Tamil keyword dictionary if AI latency > 3,000 ms or confidence < 0.65.
  * Strict Human-in-the-Loop review gate: supervisor notes and risk alerts require merchandiser approval before appearing on buyer screens.
* **Low-End Floor Hardware Accommodations:**
  * Client-side offscreen canvas compression (downsampling photos to ~85 KB WebP).
  * IndexedDB offline persistence queue with UUIDv4 idempotency keys to eliminate double-counting upon network reconnection.

### Area 3: Communication (20% Weight)
* **Clear Documentation:** Exhaustive Technical Design Document, production deployment guide, and architecture diagrams.
* **Transparent Assumptions & Constraints:** Explicitly documented industry lead times, fabric overage allowances (3%), and air freight pricing metrics.
* **100% Automated Test Pass Rate:** 128 tests passing across `risk.test.ts`, `ai.fallback.test.ts`, `orders.test.ts`, and `production.test.ts`.
