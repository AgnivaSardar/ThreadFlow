# Client Brief & Problem Statement

## Project Overview
* **Client:** Company A, Tiruppur, Tamil Nadu.
* **Domain:** Knitwear exporter manufacturing for UK and European apparel brands (e.g., Company B in the UK, Company C in Germany).
* **Operation Scale:** 3 owned manufacturing units + dedicated subcontracted printing and washing units, ~900 factory floor workers, 35 office/merchandising personnel.
* **Annual Volume:** ~500 export POs annually; revenue ₹95–110 Crore/year.
* **Simulated Baseline Date:** `2026-11-02` (Autumn Pre-Holiday Ship Window).

---

## 1. The Operational Problem & Client Financial Loss

Today, merchandisers track orders across large Excel sheets, updated manually by calling unit floor supervisors. Each order's Time-and-Action (TNA) plan lives in a disconnected sheet. Foreign buyers email continuously for updates and stage photos, while fabric defects, needle breaks, and lot delays are shared haphazardly on WhatsApp.

### Quantified Financial Bleed (₹1.08 Crore Annual Drain)
* **Annual Order Volume:** 500 orders/year @ ₹21 Lakh average PO value.
* **Late Shipment Rate:** 8% (40 orders shipped late annually).
* **Air Freight Escalation:** 15 late orders forced onto emergency air cargo @ ₹3.5 Lakh extra per shipment = **₹52.5 Lakh/year**.
* **Late Shipment Commercial Deductions:** 25 orders hit with late delivery discounts (5% invoice penalty: $25 \times ₹1.05\text{ Lakh}$) = **₹26.25 Lakh/year**.
* **Merchandiser Status-Chasing Overhead:** 12 senior merchandisers spending 2 hours daily chasing floor supervisors ($7,200\text{ hours/year} \times ₹400/\text{hr}$) = **₹28.8 Lakh/year**.
* **Total Annual Cost:** **₹1.08 Crore / year**.

---

## 2. Target Users & Personas

1. **Merchandisers (Internal Operations):** Setup orders and TNA milestone sequences, monitor factory-wide risk status board, verify/override AI reason classifications, authorize buyer visibility, generate weekly buyer reports.
2. **Unit Supervisors (Factory Floor):** Enter daily output quantities per stage directly from mobile devices on the shop floor, attach photo evidence, and log delay notes via Tamil voice or text.
3. **Foreign Buyers / Sourcing Staff (Read-Only Portal):** Access a strictly isolated, read-only portal showing real-time milestone progress, approved photos, and verified mitigation plans without email back-and-forth.
4. **Managing Director / Factory GM:** High-level executive dashboard showing total "₹ At Risk Across Factory" and shipment reliability trends.

---

## 3. The Core Build Scope

Software engineering candidates must deliver this slice **end-to-end in approximately 6 to 8 screens**:
1. **Order Setup with TNA Milestones:** PO number, style, colour and size breakdowns, ex-factory date, unit assignment, and sequential TNA milestones.
2. **Supervisor Mobile Daily Update:** Stage output entry, photo upload, Tamil voice/text issue logging, with offline queueing support for 2–3 GB RAM phones.
3. **Order Board with Run-Rate Status:** Visual Green, Amber, Red cards filtered by buyer, manufacturing unit, and shipping week.
4. **Delay Projection Engine ("Show-Your-Math"):** Real-time daily required rate vs actual rolling output (3-day WMA), calculating days late and financial exposure in Rupees.
5. **Human-in-the-Loop Buyer Portal:** Scoped, read-only view accessible via single-use magic links or scoped auth; warnings and photos reach buyers only after merchandiser confirmation.
6. **Tamil Voice/Text AI Classification:** Categorizes colloquial Tamil notes into 7 operational categories with a deterministic local keyword fallback.
7. **Compliance Audit Trail:** Immutable log recording all critical date modifications with mandatory reason codes and diff snapshots.

---

## 4. Operational Boundaries

### In Scope
* End-to-end relational data model (PostgreSQL + Prisma).
* Role-based access control (Merchandiser, Supervisor, Buyer, Admin).
* Deterministic run-rate math engine (excluding Sundays and factoring downstream stage buffers).
* Tamil voice-to-text / text issue classifier with deterministic keyword fallback.
* Memory-conscious offline synchronization queue for floor devices.
* Scoped multi-tenant buyer isolation.
* Weekly PDF/Excel report generator.

### Out of Scope
* Costing, fabric inventory, yarn procurement, worker attendance, and payroll.
* Export customs documentation, shipping bills, and formal bank invoices.

---

## 5. Seed Baseline Data (Calibrated to 2026-11-02)

| PO Number | Buyer | Style | Total Qty | Ex-Factory Date | Current Stage | Qty Done | Baseline Status & Diagnosis |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **`B-PO-88213`** | Company B (UK) | Men's crew neck tee, navy | 12,000 | 2026-11-20 | Stitching | 6,800 | 🟢 **GREEN**: On track; rolling rate exceeds required rate with positive buffer. |
| **`B-PO-88240`** | Company B (UK) | Men's polo, white | 8,000 | 2026-11-12 | Finishing | 5,200 | 🔴 **RED**: 2,800 pcs remaining across 9 working days. Deficit: -111 pcs/day. Projected 5 days late; ₹3.5 Lakh air freight risk. |
| **`C-PO-0488`** | Company C (Germany) | Kids printed tee, yellow | 10,000 | 2026-11-28 | Printing | 3,100 | 🟡 **AMBER**: 6,900 pcs remaining. Subcontractor bottleneck; 11-day downstream buffer triggers early 2-week warning. |

---

## 6. Reviewer Evaluation Rubric

| Area | Weight | Evaluation Criteria |
| :--- | :---: | :--- |
| **Quality of Work** | **50%** | Production-ready architecture, clean code structure, error handling, robust test coverage, security (no credentials in repo, input validation, buyer isolation), and polished responsive UI (mobile supervisor + desktop merchandiser). |
| **Problem Solving** | **30%** | Accurate industrial mathematical formulas (Sunday exclusion, downstream buffer offsets), resilient AI handling with fallback, memory-safe offline handling for low-end hardware, and industrial edge-case defenses. |
| **Communication** | **20%** | Thorough Technical Design Document (TDD), clear deployment runbook, well-documented assumptions, honest notes on limits and future roadmap, and clear commit history. |
