# Anything You Want Us to Know — ThreadFlow Engineering & Design Notes

**Candidate Submission Note for Evaluators & Technical Leadership**
* **Project:** ThreadFlow — Knitwear Production Intelligence & Critical Path OS
* **Repository:** [https://github.com/AgnivaSardar/ThreadFlow](https://github.com/AgnivaSardar/ThreadFlow)
* **Live Web Application:** [https://threadflow-ptun.onrender.com](https://threadflow-ptun.onrender.com)
* **Live Backend API Service:** [https://threadflow-backend-z7s9.onrender.com](https://threadflow-backend-z7s9.onrender.com)

---

### 1. Grounded in the Realities of the Tiruppur Export Cluster
ThreadFlow was not designed as an abstract SaaS exercise or a generic kanban board. Every architectural and interface decision was shaped by the operational realities of the knitwear export cluster in Tiruppur, Tamil Nadu:
* **The Communication Bottleneck:** 12 merchandisers spending 2 hours a day chasing updates across three owned factories and subcontracted washing/printing units.
* **The Device Reality:** Floor supervisors operating low-cost Android phones (2–3 GB RAM) in tin-roof factory sheds with intermittent 4G/Wi-Fi connectivity.
* **The Financial Stakes:** 40 late shipments a year bleeding ₹1.08 Crore in air-freight penalties (₹3.5 Lakh per emergency shipment) and 5% buyer delay discounts. Finding out an order is late 2 days before the ship date is fatal; catching it 14–18 days early during Knitting or Dyeing saves the factory.

---

### 2. Deterministic Engineering Over "AI Hype"
A foundational design principle of ThreadFlow is **separation of concerns between deterministic mathematics and probabilistic language models**:
* **The Delay Engine is 100% Deterministic Math ("Show-Your-Math"):**
  We deliberately **rejected** using an LLM to predict delivery dates, estimate run rates, or assess financial liabilities. In export manufacturing, hallucinated numbers destroy trust with production directors and foreign buyers. The run-rate delay warning engine is pure, auditable arithmetic: Sunday-excluded calendar math, 3-day Weighted Moving Average ($0.50 \cdot Q_t + 0.30 \cdot Q_{t-1} + 0.20 \cdot Q_{t-2}$), and hard downstream buffer reservations (14 to 18 buffer days across Checking, Finishing, and Audit).
* **AI is Applied Strictly to Linguistic Extraction:**
  AI is utilized exclusively where natural language models excel: translating unstructured, colloquial Tamil voice dictation and notes into clean English summaries and standardized root-cause categories (`MACHINE_BREAKDOWN`, `FABRIC_DELAY`, `LABOUR_SHORTAGE`, etc.).
* **Zero-Downtime Dual-Tier Fallback:**
  If the Google Gemini 3.1 Flash Lite API experiences high latency (>3,000ms), rate limits (HTTP 429), or network dropouts, an in-memory deterministic regex engine scanning colloquial Tiruppur textile slang (*"கரண்ட் கட்"*, *"மெஷின் பிரேக் டவுன்"*, *"ஆட்கள் வரவில்லை"*) activates in sub-2ms. The floor supervisor's shift entry never fails.
* **Human-in-the-Loop Review Gate:**
  In accordance with the client's strict governance constraint, unverified AI translations and unapproved factory floor photos **never reach the buyer portal automatically**. The merchandiser reviews the Tamil note side-by-side with the English translation and must explicitly confirm it before it becomes buyer-visible.

---

### 3. Multi-Tenant Brand Privacy & Scoped Access
Apparel brands (Marks & Spencer, Next, Zara/Inditex, Company B, Company C) fiercely protect their styles, order volumes, and factory allocations under strict non-disclosure agreements:
* One buyer must **never** see another buyer's styles, purchase orders, or progress.
* ThreadFlow enforces multi-tenant boundary checks directly at the database query layer (`buyerId` scoping enforced in JWT middleware and Prisma query filters).
* In the live demo, signing in as `buyer@company-b.co.uk` exposes **only** Company B purchase orders (`B-PO-88213` and `B-PO-88240`). Company C's styles, internal mill delays, and production outputs are completely invisible.

---

### 4. Resilient Offline-First Edge Architecture
* Factory floor connectivity drops frequently in industrial clusters.
* Rather than failing or showing network error dialogs, supervisor shift logs queue transparently in client-side **IndexedDB**.
* Each shift submission is stamped with a client-generated **RFC 4122 UUIDv4 idempotency key**. When connectivity is restored, the background edge sync worker flushes updates to the backend, guaranteeing that network retries never double-count pieces or distort the rolling run-rate average.

---

### 5. Deliberate Scope Discipline (What We Built vs. What We Cut)
We respected the client problem statement's strict boundary conditions:
* **What We Cut (Honoring Out-of-Scope Directives):**
  - **No ERP Fabric Inventory Bloat:** We did not build yarn procurement, GSM yarn-lot tracking, or warehouse roll inventory.
  - **No Payroll or Worker Attendance:** We tracked shift output pieces and machine line capacity, not biometric worker attendance or piece-rate wage calculation.
  - **No Invoicing or Customs Export Documentation:** We focused strictly on production velocity and delivery schedule health.
  - **Mocked External Integrations:** Rather than paying for enterprise WhatsApp Business API numbers or carrier gateways, we implemented native `wa.me` deep links for instant supervisor nudges and optional SendGrid OTP delivery.
* **What We Added for Production Usability:**
  - **"What-If" Recovery Simulator:** Allows merchandisers to test interventions (e.g., adding 1 stitching line or running 2 hours of overtime) and see the order flip from Red to Green before committing capital.
  - **SHA-256 Tamper-Evident Compliance Audit Ledger:** Buyers' compliance teams require a permanent, unalterable history of every milestone date shift and reason code.
  - **Weekly Multi-Bar TNA Progress PDF Export:** Generates clean, client-ready status sheets that reduce routine status chasing emails by over 60%.

---

### 6. Verification & Test Suite
The codebase is backed by **128 automated unit and integration tests (100% pass rate)** executed via `npm --prefix backend test`:
* 34 tests verifying the mathematical run-rate engine, Sunday exclusions, and buffer preservation.
* 35 tests verifying the Gemini API contract, SLA timeout racing, and Tiruppur Tamil regex dictionary fallback.
* 32 tests verifying 7-stage sequential TNA milestone templates and color/size quantity conservation.
* 27 tests verifying production ingestion invariants (3% fabric tolerance ceiling, anti-finger-slip checks, and idempotency deduplication).

---

### 7. Demo Access & Quick Review
* **All test accounts use password:** `ThreadFlow@2026`
* **Merchandiser:** `merchandiser@company-a.com`
* **Unit 1 Supervisor:** `supervisor.muthu@company-a.com`
* **Foreign Buyer:** `buyer@company-b.co.uk`
* **Admin / Managing Director:** `admin@threadflow.com` or `agniva.sardar@gmail.com`
