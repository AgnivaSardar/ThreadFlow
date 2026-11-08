# ThreadFlow — Knitwear Production Intelligence & Critical Path OS
> **Know the delay before it happens.**  
> Real-time production tracking, deterministic run-rate risk engine, bilingual Tamil/Hindi voice telemetry, and scoped buyer visibility for export garment manufacturers.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-128%20Passing-brightgreen.svg)]()

---

## Executive Overview & Business Value

Built for **Company A** (Tiruppur, Tamil Nadu) — a knitwear exporter manufacturing ~500 export POs annually (₹95–110 Crore turnover) for UK and European retail brands.

ThreadFlow replaces fragmented WhatsApp chats, manual phone calls, and static spreadsheets with an automated, explainable operational command center that halts a **₹1.08 Crore annual financial bleed**:

| Source of Loss | Pre-ThreadFlow Reality | With ThreadFlow | Annual Savings |
| :--- | :--- | :--- | :---: |
| **Emergency Air Freight** | 15 orders/yr forced to air cargo @ ₹3.5L extra | Early bottleneck detection & buffer mitigation | **₹52.5 Lakh** |
| **Late Delivery Deductions** | 25 orders hit with 5% invoice penalties | Proactive schedule recovery & buyer alignment | **₹26.25 Lakh** |
| **Merchandiser Chasing Overhead** | 12 merchandisers spending 2 hrs/day calling units | Automated real-time floor telemetry | **₹28.8 Lakh** |
| **Total Annual Recovery** | | | **₹1.08 Crore / yr** |

---

## System Architecture

ThreadFlow is architected as a robust **Modular Monolith** with clear domain separation, strictly scoped role permissions, and an offline-resilient edge for factory shop floor conditions.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               THREADFLOW UNIFIED FRONTEND               │
                    │         React 18 • TypeScript • Tailwind CSS • Vite     │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                                 Reverse Proxy /api/v1 (JWT)
                                               │
                    ┌──────────────────────────▼─────────────────────────────┐
                    │               THREADFLOW BACKEND ENGINE                │
                    │                Node.js • Express • TypeScript          │
                    ├────────────────────────────────────────────────────────┤
                    │  • Auth & RBAC Domain          • Risk & Capacity Math  │
                    │  • Orders & TNA Pipeline       • Offline Ingestion Queue│
                    │  • Gemini AI & Tamil NLP       • Buyer Portal Boundary │
                    │  • Cryptographic Audit Engine  • Weekly PDF Generator  │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                    ┌──────────────────────────▼─────────────────────────────┐
                    │            SUPABASE POSTGRESQL (ACID STORE)             │
                    │               Prisma ORM • Connection Pooler            │
                    └────────────────────────────────────────────────────────┘
```

---

## Key System Features

1. **Order Setup & 7-Stage TNA Milestone Engine:**  
   Automatically instantiates knitting, dyeing/washing, printing, cutting, stitching, checking, and finishing stages with industry buffer offsets and size breakdown ratios (`S`, `M`, `L`, `XL`).

2. **Deterministic "Show-Your-Math" Run-Rate Engine:**  
   Calculates daily required rate vs 3-day weighted moving average ($0.50 \cdot R_1 + 0.30 \cdot R_2 + 0.20 \cdot R_3$), excludes non-working Sundays, factors downstream buffers, and computes rupee exposure directly.

3. **Bilingual Shop Floor Telemetry & Tamil Voice:**  
   Floor supervisors log shift output on low-end hardware using the browser's native **Web Speech API** in Tamil (`ta-IN`), Hindi (`hi-IN`), or English (`en-IN`), with offline-first IndexedDB queueing and photo compression.

4. **Resilient AI Classification with Deterministic Fallback:**  
   Classifies colloquial factory notes into 7 operational root causes using Google Gemini API, automatically falling back to an embedded dual-script regex dictionary (`TAMIL_FALLBACK_DICTIONARY`) if latency exceeds 3,000 ms.

5. **Human-in-the-Loop Buyer Portal:**  
   Strict multi-tenant buyer isolation. Foreign brands view real-time milestone progress and defect photos *only after merchandiser confirmation*, eliminating premature panic.

6. **Tamper-Evident Cryptographic Audit Trail:**  
   Continuous SHA-256 Merkle chain recording every critical date reschedule with mandatory reason codes, previous/new diffs, and acting user IDs.

---

## Pre-Configured Demo Accounts

All demo accounts use password: `ThreadFlow@2026`

| Persona | Email | Role | Recommended Test Flow |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@threadflow.com` | `ADMIN` | Global oversight, audit log review, and user administration. |
| **Senior Merchandiser** | `merchandiser@threadflow.com` | `MERCHANDISER` | Order Board, "Show-Your-Math" details, What-If simulator, and PDF report generator. |
| **Floor Supervisor (Unit 1)** | `supervisor.muthu@threadflow.com` | `SUPERVISOR` | Unit 1 floor view, Tamil voice logging, and photo proof capture. |
| **Floor Supervisor (Unit 2)** | `supervisor.selvam@threadflow.com` | `SUPERVISOR` | Unit 2 & 3 stitching lines. |
| **Foreign Buyer (UK)** | `sourcing@company-b.co.uk` | `BUYER` | Scoped Buyer Portal (`B-PO-88213`, `B-PO-88240`), confirmed photos only. |
| **Foreign Buyer (Germany)** | `compliance@company-c.de` | `BUYER` | Scoped Buyer Portal (`C-PO-0488`). |

---

## Quick Start (Local Setup)

### 1. Prerequisites
* Node.js v20+ (LTS)
* npm v10+

### 2. Backend Setup
```bash
cd backend
npm install
npx prisma db push
npm run seed:calibrated
npm run dev
```
Backend runs on `http://localhost:4000`.

### 3. Frontend Setup
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to sign in.

---

## Automated Test Verification

Run all test suites across the 4 major operational engines:

```bash
npm --prefix backend test
```

```
================================================================
🏁 RISK ENGINE TEST SUITE: 34 PASSED | 0 FAILED
🏁 RESILIENT TAMIL AI PIPELINE: 35 PASSED | 0 FAILED
🏁 ORDERS & TNA MILESTONE ENGINE: 32 PASSED | 0 FAILED
🏁 PRODUCTION INGESTION & INVARIANTS: 27 PASSED | 0 FAILED
================================================================
TOTAL: 128 PASSED | 0 FAILED (100% PASS RATE)
```

---

## Cloud Deployment (Render)

ThreadFlow deploys natively on Render as a Node.js Web Service (backend) and Static Site (frontend):

1. **Backend Service:**
   * Build Command: `npm install && npx prisma db push && npm run build`
   * Start Command: `npm start`
2. **Frontend Site:**
   * Build Command: `npm install && npm run build`
   * Publish Directory: `dist`
   * Rewrite: `/*` $\to$ `/index.html`

---

## Documentation Directory

The project documentation has been consolidated into 4 comprehensive guides:

* [**Reviewer Evaluation Guide (`docs/REVIEWER_GUIDE.md`)**](docs/REVIEWER_GUIDE.md): Direct mapping to the 50% Quality / 30% Problem Solving / 20% Communication rubric with step-by-step persona test paths.
* [**Technical Design Document (`TECHNICAL_DESIGN_DOCUMENT.md`)**](TECHNICAL_DESIGN_DOCUMENT.md): Exhaustive TDD covering architectural decisions, relational invariants, and mathematical formulas.
* [**Deployment & Operations Runbook (`docs/DEPLOYMENT_RUNBOOK.md`)**](docs/DEPLOYMENT_RUNBOOK.md): Complete setup guide, Supabase pooler tuning, Render instructions, and environment variable dictionary.
* [**API & Data Model Specification (`docs/API_AND_DATA_SPECIFICATION.md`)**](docs/API_AND_DATA_SPECIFICATION.md): Definitive entity dictionary, foreign key invariants, complete REST endpoints, and UI design tokens.
* [**Client Brief & Problem Statement (`docs/PROBLEM_STATEMENT.md`)**](docs/PROBLEM_STATEMENT.md): Problem background, operational boundaries, and seed baseline parameters.
