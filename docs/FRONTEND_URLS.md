# ThreadFlow — Authenticated Screen URLs & Access Guide

All routes in ThreadFlow are strictly protected behind session authentication. Open and passwordless URLs have been removed; all users must authenticate with valid credentials.

---

## 1. Running Server Endpoints

| Service | Local URL | Description | Database / User | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Frontend Web App (PWA)** | `http://localhost:5173` | React 18 + Vite PWA application | — | 🟢 Active |
| **Backend REST API** | `http://localhost:4000/api/v1` | Express + TypeScript API server | `threadflow_db` (`dbuser`) | 🟢 Active |
| **Backend Health Check** | `http://localhost:4000/api/v1/health` | Service uptime and status probe | — | 🟢 Active |

---

## 2. Active Screen URLs & Role-Based Views

### Main Authenticated Portal
* **URL:** `http://localhost:5173/login`
* **Features:**
  * **1-Click Reviewer Demo Quick-Fill Bar:** Four pre-configured buttons for Merchandiser, Supervisor Muthu, Buyer B (UK), and Buyer C (Germany) that autofill credentials and sign in directly via `POST /api/v1/auth/login`.
  * **Secure Credentials Form:** Email address and password with visibility toggle.
  * **No Open / Unauthenticated URLs:** All routes require a valid 15-minute Bearer JWT and 7-day HttpOnly cookie session.

### Authenticated Workspace Targets (Post-Login)
| Persona | Authenticated User | Redirect Screen URL | Workspace Description |
| :--- | :--- | :--- | :--- |
| **Merchandiser** | `merchandiser@company-a.com` | `http://localhost:5173/orders` | **Merchandiser Command Center:** All 3 factory units, TNA milestone progression, 3-day run-rate delay calculations, AI issue confirmation gate, and weekly PDF/Excel status exports. |
| **Floor Supervisor** | `supervisor.muthu@company-a.com` | `http://localhost:5173/supervisor/my-work` | **Supervisor Mobile Floor View:** Mobile-first interface (`max-width: 480px`), quick-tap increment chips (`+50`, `+100`), native Tamil voice logging, and offline sync queue. |
| **Buyer B (UK)** | `buyer@company-b.co.uk` | `http://localhost:5173/buyer-portal` | **Company B Buyer Portal:** Strictly isolated read-only view of Company B export orders (`B-PO-88213`, `B-PO-88240`), displaying only merchandiser-confirmed warnings and approved photos. |
| **Buyer C (Germany)** | `compliance@company-c.de` | `http://localhost:5173/buyer-portal` | **Company C Buyer Portal:** Strictly isolated view of Company C export orders (`C-PO-0488`). Zero access to Company B data. |

---

## 3. Seeded Local Credentials (Database: `threadflow_db`, User: `dbuser`)

All review accounts share the default seed password: `ThreadFlow@2026`.

| Role | Email | Password | Assigned Unit / Tenant Scope |
| :--- | :--- | :--- | :--- |
| **Merchandiser** | `merchandiser@company-a.com` | `ThreadFlow@2026` | Factory Internal (Units 1, 2, 3 & Subcontractors) |
| **Floor Supervisor** | `supervisor.muthu@company-a.com` | `ThreadFlow@2026` | Tiruppur Unit 1 (Knitting & Finishing) |
| **Buyer B (UK)** | `buyer@company-b.co.uk` | `ThreadFlow@2026` | Company B (UK Retailers) |
| **Buyer C (Germany)** | `compliance@company-c.de` | `ThreadFlow@2026` | Company C (Germany Fashion AG) |

---

## 4. Backend Auth API Endpoints Reference

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Validates email & password; sets 7-day `refreshToken` HttpOnly cookie and returns 15-minute `accessToken`. |
| `POST` | `/api/v1/auth/refresh` | Cookie | Reads HttpOnly `refreshToken` and re-issues a fresh 15-minute `accessToken`. |
| `POST` | `/api/v1/auth/logout` | Public | Clears the `refreshToken` cookie and terminates the session. |
| `GET` | `/api/v1/auth/me` | Bearer Token | Returns current authenticated user profile, assigned unit, and tenant scope. |
| `GET` | `/api/v1/health` | Public | Returns `{ status: "ok", timestamp: "..." }`. |
