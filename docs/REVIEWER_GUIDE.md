# Reviewer Evaluation Guide & Submission Blueprint

This guide maps the ThreadFlow implementation directly to the reviewer evaluation criteria and client brief requirements.

---

## 1. Submission Deliverables Mapping

As required by the client brief, the final submission consists of:
1. **Technical Design Document (`TECHNICAL_DESIGN_DOCUMENT.md` / PDF ready):**
   * GitHub Repository URL at the top.
   * Executive summary & quantified business impact (₹1.08 Crore annual loss breakdown).
   * Modular Monolith architecture rationale.
   * Complete relational schema and invariant enforcement rules.
   * Deterministic "Show-Your-Math" run-rate engine formulas (excluding Sundays + downstream stage buffers).
   * Resilient Tamil/Tanglish AI classifier with local deterministic fallback dictionary.
   * Memory-safe offline PWA architecture for 2–3 GB RAM floor devices.
   * High-impact industrial USPs (Financial Exposure Calculator, "What-If" Recovery Simulator, Tamil Voice Keypad, Audit Diff Log).
   * Trade-offs, intentional cuts, and future extensions.
2. **Deployment & Operations Runbook (`deployment.md`):**
   * Step-by-step local setup (Node.js, PostgreSQL, Prisma migrations, seed data).
   * Production containerization via multi-stage Docker & Docker Compose.
   * Environment variable dictionary (names only, no secrets).
   * Pre-configured demo user accounts for immediate evaluation.

---

## 2. Reviewer Pre-Configured Demo Accounts

| Role | Username / Email | Password | Primary Reviewer Workflows to Test |
| :--- | :--- | :--- | :--- |
| **Merchandiser** | `merchandiser@company-a.com` | `ThreadFlow@2026` | Factory Order Board (Green/Amber/Red), Order & TNA Setup, "Show-Your-Math" run-rate details, AI Issue Review & Confirmation Gate, What-If Recovery Simulator, Weekly Buyer PDF/Excel Export. |
| **Floor Supervisor** | `supervisor.unit1@company-a.com` | `ThreadFlow@2026` | Mobile-optimized shop floor view, Tamil keypad (+50, +100 chips), Web Speech audio/Tamil text input, photo capture, offline sync queue simulation. |
| **Buyer (Company B - UK)** | `sourcing@company-b.co.uk` | `ThreadFlow@2026` | Scoped Buyer Portal (`B-PO-88213`, `B-PO-88240`), only merchandiser-confirmed warnings and photos, zero access to Company C orders (HTTP 404 isolation). |
| **Buyer (Company C - DE)** | `compliance@company-c.de` | `ThreadFlow@2026` | Scoped Buyer Portal (`C-PO-0488`), verified tenant boundary checks. |

---

## 3. Reviewer Scoring Breakdown & Implementation Coverage

### Area 1: Quality of Work (50% Weight)
* **ACID Relational Model:** PostgreSQL 16 + Prisma schema with foreign keys, cascading deletes, unique constraints (e.g. `idempotencyKey`, `[orderId, size, color]`), and explicit indexing for high-query paths.
* **Architecture:** Modular Monolith in TypeScript with strict boundaries (Auth, Orders, Production, Risk, AI, Buyer Portal, Audit).
* **Dual-Persona Interface:**
  * Desktop-first command center for Merchandisers with high information density.
  * Mobile-first high-contrast UI for Factory Floor Supervisors (minimum 54px touch targets).
* **Security & Multi-Tenant Isolation:**
  * JWT access/refresh token rotation.
  * Database queries strictly scoped to `req.user.buyerId` for buyer routes.
  * Cryptographic single-use magic links for foreign brand compliance officers.

### Area 2: Problem Solving (30% Weight)
* **Deterministic Run-Rate Engine:**
  * Excludes non-working Sundays in calendar calculations.
  * Incorporates 3-day weighted moving average (0.50, 0.30, 0.20) to smooth single-day outliers.
  * Enforces Tiruppur knitwear downstream stage buffers (e.g. 11 days for printing, 3 days for stitching).
  * Direct financial exposure calculation (₹1,05,000 late penalty or ₹3,50,000 air freight escalation).
* **AI Resilience & Human Gate:**
  * Tamil/Tanglish semantic classification using Gemini 2.5 Flash.
  * Instant fallback to an embedded local Tamil keyword dictionary if AI latency > 3,000 ms or confidence < 0.65.
  * Strict Human-in-the-Loop review gate: supervisor notes and risk alerts require merchandiser approval before appearing on buyer screens.
* **Low-End Floor Hardware Accommodations:**
  * Client-side offscreen canvas compression (downsampling 6–8 MB photos to ~85 KB WebP).
  * IndexedDB offline persistence queue with UUID idempotency keys to eliminate double-counting upon network reconnection.

### Area 3: Communication (20% Weight)
* **Clear Documentation:** Exhaustive Technical Design Document, production deployment guide, and architecture diagrams.
* **Transparent Assumptions & Constraints:** Explicitly documented industry lead times, fabric overage allowances (3%), and air freight pricing metrics.
* **Git Commit Hygiene:** Clear, modular, and conventional commits tracing the feature development progression.
