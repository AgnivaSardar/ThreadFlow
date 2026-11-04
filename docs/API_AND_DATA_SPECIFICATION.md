# ThreadFlow — API & Data Model Specification (`API_AND_DATA_SPECIFICATION.md`)

This document provides the definitive technical specification for ThreadFlow's relational schema, API contracts, RBAC security matrix, and UI design system.

---

## 1. Relational Data Model (PostgreSQL + Prisma)

All primary keys use **CUID** (`@default(cuid())`), providing URL-safe, time-ordered, collision-resistant identifiers that eliminate sequential enumeration risks and prevent B-Tree index fragmentation under high-frequency factory floor writes.

### Primary Entities

| Model | Table Name | Purpose | Key Constraints & Invariants |
| :--- | :--- | :--- | :--- |
| **`User`** | `User` | Authenticated operators across all roles | Unique email, foreign keys to `Buyer` and `Unit` |
| **`Buyer`** | `Buyer` | Foreign brand apparel customers (Company B, Company C) | Unique code (`COMPANY_B`, `COMPANY_C`), multi-tenant partition root |
| **`Unit`** | `Unit` | Manufacturing facilities (3 Owned Units + Subcontractors) | Unique code (`UNIT_1`, `UNIT_2`, `UNIT_3`, `PRINTTEX`, `WASHTEX`) |
| **`Order`** | `Order` | Purchase orders tracked through production | Unique `poNumber`, optimistic locking `version`, Soft-delete `deletedAt` |
| **`OrderLine`** | `OrderLine` | Planned quantity per size (`S`, `M`, `L`, `XL`) and color | `@@unique([orderId, size, color])` |
| **`TnaMilestone`** | `TnaMilestone` | 7 sequential knitwear stages | Sequence order 1–7, stage buffer days ahead, foreign key to `Order` |
| **`ProductionUpdate`** | `ProductionUpdate` | Shift-level stage output logged from shop floor | Unique UUIDv4 `idempotencyKey` prevents double-counting upon reconnect |
| **`ProductionUpdateLine`** | `ProductionUpdateLine` | Good & rejected quantity broken down per size/color | Prevents the "99% Done Size-Ratio Skew Trap" |
| **`ProductionPhoto`** | `ProductionPhoto` | Defect evidence photos and stage proofs | Approved gate (`isBuyerVisible: false` until confirmed) |
| **`RiskWarning`** | `RiskWarning` | Real-time run-rate deficits and delivery delay warnings | Required vs actual rolling rate, financial exposure in Rupees |
| **`RiskMitigationAction`** | `RiskMitigationAction` | Capacity interventions (overtime, extra line, subcontract) | Financial cost auditing, authorized by merchandiser |
| **`IssueClassification`** | `IssueClassification` | AI and regex classified factory floor delay root-causes | Raw Tamil text, English translation, confidence score, category |
| **`AuditEvent`** | `AuditEvent` | Cryptographically hashed tamper-evident compliance trail | Continuous SHA-256 Merkle chain, mandatory reason codes |
| **`WeeklyBuyerReport`** | `WeeklyBuyerReport` | Frozen weekly milestone snapshots (PDF/JSON) | Buyer-isolated historical compliance archives |

---

## 2. 7-Stage Knitwear Critical Path Milestones & Buffers

Tiruppur knitwear export manufacturing requires strict sequential buffer deduction from the Ex-Factory date:

| Sequence | Stage Name | Standard Buffer | Typical Lead Time | In-House / Subcontract |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **KNITTING** | **18 Days** | 7 Days | Unit 1 (Own circular knitting) |
| **2** | **DYEING_WASHING** | **14 Days** | 7 Days | Unit 1 / Partner WashTex |
| **3** | **PRINTING** | **11 Days** | 4 Days | Partner PrintTex (Subcontract) |
| **4** | **CUTTING** | **9 Days** | 4 Days | Unit 1 (Own precision cutting) |
| **5** | **STITCHING** | **3 Days** | 6 Days | Unit 2 & 3 (Own assembly lines) |
| **6** | **CHECKING** | **2 Days** | 2 Days | Unit 1 & 2 (100% inspection) |
| **7** | **FINISHING** | **0 Days** | 2 Days | Unit 1 (Steam press, tag, carton pack) |

---

## 3. Core REST API Contracts (`/api/v1`)

All endpoints use `/api/v1` and structured JSON request/response envelopes. Every request payload is strictly validated using Zod schemas.

### Authentication & Sessions (`/auth`)
- `POST /api/v1/auth/login`: Authenticate with work email & password. Sets 7-day HttpOnly refresh cookie and returns 15m JWT access token.
- `POST /api/v1/auth/refresh`: Exchange refresh cookie for a fresh access token.
- `POST /api/v1/auth/logout`: Revoke active session and clear cookie.
- `POST /api/v1/auth/forgot-password`: Request password recovery instructions for work email.
- `GET /api/v1/auth/me`: Current user profile and assigned permissions.

### Order Operations (`/orders`)
- `GET /api/v1/orders`: Paginated order listing with filters (`status`, `buyerId`, `unitId`, `shipWeek`, `search`).
- `POST /api/v1/orders`: Create new PO with style, quantity, size breakdown, unit assignment, and auto-generated 7 TNA milestones.
- `GET /api/v1/orders/:id`: Full order detail, TNA milestone schedule, size breakdown progress, and audit trail.
- `PATCH /api/v1/orders/:id/dates`: Reschedule Ex-Factory date (requires mandatory `reasonCode`, records `AuditEvent`).
- `POST /api/v1/orders/bulk-shift`: Bulk reschedule multiple orders impacted by common supply-chain bottlenecks.

### Shop Floor Telemetry (`/production`)
- `GET /api/v1/production/work`: Unit-scoped work order queue for the authenticated supervisor.
- `POST /api/v1/production/update`: Ingest shift output with UUIDv4 `idempotencyKey`, good/rejected counts, per-size breakdowns, defect photo, and bilingual voice/text notes.
- `POST /api/v1/production/bulk`: High-efficiency batch upload for offline synchronization.
- `GET /api/v1/production/audit-chain/:milestoneId`: Cryptographic verification of milestone output Merkle hash chain.

### Risk & Capacity Engine (`/risk`)
- `GET /api/v1/risk/active`: Factory-wide delivery risk board (Red, Amber, Green) with run-rate math and financial exposure.
- `POST /api/v1/risk/simulate`: Interactive "What-If" simulator evaluating overtime hours, extra stitching lines, and schedule recovery.
- `POST /api/v1/risk/alerts/:id/confirm`: Merchandiser Human-in-the-Loop approval gate (flags warning buyer-visible).
- `POST /api/v1/risk/alerts/:id/override`: Merchandiser overrides risk warning with internal explanation.

### Foreign Buyer Portal (`/buyer-portal`)
- `GET /api/v1/buyer-portal/orders`: Strictly isolated order board displaying only the authenticated buyer's orders.
- `GET /api/v1/buyer-portal/orders/:id`: Read-only milestone schedule and progress.
- `GET /api/v1/buyer-portal/orders/:id/photos`: Verified defect proofs and stage photos (`approvalStatus === 'CONFIRMED'`).
- `POST /api/v1/buyer-portal/orders/:id/acknowledgement`: Foreign buyer acknowledges revised schedule or mitigation plan.

### AI Intelligence (`/ai`)
- `POST /api/v1/ai/classify-tamil`: Semantic NLP classification of colloquial Tamil/Tanglish notes into 7 root-cause categories.
- `POST /api/v1/ai/copilot`: ThreadFlow AI Assistant answering operational questions about orders, buffers, and factory status.

### Auditing & Compliance (`/audit` & `/reports`)
- `GET /api/v1/audit/logs`: Paginated, tamper-evident audit events with smart pagination, reason filters, and diff viewer.
- `GET /api/v1/reports/weekly`: Executive weekly shipment health briefing and 7-stage TNA comparison.
- `GET /api/v1/reports/pdf`: Generate formal branded PDF executive report with letterhead, KPIs, and multi-bar trend charts.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Capability / Route | Merchandiser | Supervisor | Foreign Buyer | System Admin |
| :--- | :---: | :---: | :---: | :---: |
| **View Factory Order Board** | ✅ Full | ❌ Scoped to Unit | ❌ Scoped to Buyer POs | ✅ Full |
| **Create & Reschedule Orders** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Submit Floor Shift Production** | ❌ No | ✅ Yes (Unit Work) | ❌ No | ✅ Yes |
| **Review & Approve AI Categories** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **View Internal Factory Delays & Photos** | ✅ All | ❌ Unit Only | ⚠️ Confirmed Only | ✅ All |
| **Simulate Capacity Interventions** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Download Compliance Audit Logs** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Generate Formal PDF Sourcing Reports** | ✅ Yes | ❌ No | ✅ Buyer-Scoped | ✅ Yes |

---

## 5. UI Design System Tokens

The ThreadFlow frontend utilizes a consistent industrial design system:

* **Primary Corporate Brand:** Midnight Navy (`#0C2D48`), Deep Ocean (`#081F33`), Slate 950 (`#020617`).
* **Accent & Actions:** Warm Industrial Amber (`#F59E0B`, `bg-amber-400 hover:bg-amber-300`).
* **Operational Status Indicators:**
  * **GREEN (On Track):** `bg-emerald-50 text-emerald-700 border-emerald-200` (Pill: `bg-emerald-500`).
  * **AMBER (Buffer Alert):** `bg-amber-50 text-amber-800 border-amber-200` (Pill: `bg-amber-500`).
  * **RED (Critical Deficit):** `bg-rose-50 text-rose-700 border-rose-200` (Pill: `bg-rose-500`).
* **Watermark Texture:** Topographic yarn line pattern (`/images/threadflow-bg.jpg`) overlaid with `linear-gradient(rgba(241, 245, 249, 0.88), rgba(241, 245, 249, 0.88))`.
* **Touch Optimization:** Touch targets on mobile supervisor screens are explicitly sized $\ge 54\text{px}$ with high-contrast inputs for shop floor readability.
