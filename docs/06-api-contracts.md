# API Contracts (`/api/v1`)

All endpoints use `/api/v1` and structured JSON request/response envelopes. Every request payload is strictly validated using Zod schemas.

## Authentication & Session Management
- `POST /api/v1/auth/login`: Authenticate with email/password; returns access JWT and sets HttpOnly refresh cookie.
- `POST /api/v1/auth/refresh`: Rotate refresh token and issue new short-lived access JWT.
- `POST /api/v1/auth/logout`: Revoke active refresh token session.
- `GET /api/v1/auth/magic-link/:token`: Validate cryptographic buyer token and issue read-only buyer session.

## Order Management (Merchandiser)
- `GET /api/v1/orders`: Filter by status (`RED`, `AMBER`, `GREEN`), buyer, unit (`Unit 1-3`, Subcontractors), ship week.
- `POST /api/v1/orders`: Create new order with style, total quantity, ex-factory date, unit, and size ratio breakdowns (`S`, `M`, `L`, `XL`).
- `GET /api/v1/orders/:id`: Full order details, TNA timeline, size breakdown progress, and audit logs.
- `PATCH /api/v1/orders/:id/dates`: Update Ex-Factory date (requires mandatory `reasonCode` and logs `AuditEvent`).

## Production Updates (Supervisor Mobile / PWA)
- `GET /api/v1/supervisor/work`: Assigned orders and active stages for current supervisor's unit.
- `POST /api/v1/production-updates`: Submit daily good and rejected quantities with:
  - `idempotencyKey` (UUIDv4)
  - `goodQuantity`, `rejectedQuantity`
  - `notes` (Tamil/Tanglish text or voice transcript)
  - `compressedPhotoUrl` (max 1024px WebP/JPEG)
  - Invariant checks: rejects if cumulative quantity > upstream completed stage or > total PO * 1.03.

## Risk Engine & Human-in-the-Loop Review (Merchandiser)
- `GET /api/v1/risk/alerts`: Fetch all pending and active risk warnings.
- `POST /api/v1/risk/alerts/:id/confirm`: Merchandiser confirms warning, selects mitigation strategy, and makes alert buyer-visible (`approvalStatus: CONFIRMED`).
- `POST /api/v1/risk/alerts/:id/override`: Merchandiser dismisses alert with internal note (`approvalStatus: OVERRIDDEN`).
- `POST /api/v1/risk/simulate`: Interactive "What-If" recovery simulator (extra stitching line, overtime hours).

## Buyer Portal (Read-Only Isolated API)
- `GET /api/v1/buyer-portal/orders`: Read-only order board filtered strictly to authenticated `buyerId`.
- `GET /api/v1/buyer-portal/orders/:id`: Stage milestones and progress.
- `GET /api/v1/buyer-portal/orders/:id/photos`: Approved photos only (`approvalStatus === 'CONFIRMED'`).
- `GET /api/v1/buyer-portal/export/weekly`: Generate real CSV/PDF weekly status report.
*Note: Any request for an order belonging to another buyer returns 403 Forbidden or 404 Not Found.*

## AI Semantic Classification
- `POST /api/v1/ai/classify`: Classify supervisor note into standardized category (`MACHINE_BREAKDOWN`, `POWER_OUTAGE`, etc.) with fallback to deterministic Tamil keyword dictionary.
- `POST /api/v1/ai/override`: Merchandiser corrects AI category classification; recorded in audit log.
