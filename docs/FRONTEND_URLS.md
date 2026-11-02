# ThreadFlow — Frontend Screen URLs & Access Guide

This document lists all active frontend URLs, routes, demo login credentials, and navigation targets for reviewing **ThreadFlow**.

---

## 1. Running Server Endpoints

| Service | Local URL | Description | Status |
| :--- | :--- | :--- | :---: |
| **Frontend Web App (PWA)** | `http://localhost:5173` | React 18 + Vite PWA application | 🟢 Active |
| **Backend REST API** | `http://localhost:4000/api/v1` | Express + TypeScript API server | 🟢 Active |
| **Backend Health Check** | `http://localhost:4000/api/v1/health` | Service uptime and status probe | 🟢 Active |

---

## 2. Active Frontend Screen URLs & Routes

### A. Authentication & Access Portal
* **Main Login Screen:**
  * **URL:** `http://localhost:5173/login`
  * **Purpose:** Primary sign-in screen designed for Company A's factory and export operations.
  * **Features:**
    * **1-Click Reviewer Demo Quick-Fill Bar:** Four pre-configured buttons for Merchandiser, Supervisor Muthu, Buyer B (UK), and Buyer C (Germany) that autofill and sign in with a single click.
    * **Standard Login Form:** Manual email and password entry with visibility toggle.
    * **Passwordless Buyer Magic Link Tab:** Direct token input for foreign brand representatives.

* **Passwordless Buyer Magic Link Direct Route:**
  * **URL Example:** `http://localhost:5173/magic-link/demo_magic_link_company_b_uk_2026`
  * **Purpose:** Enables foreign retail compliance officers to bypass passwords entirely.
  * **Pre-Seeded Test Link:** `demo_magic_link_company_b_uk_2026` (Valid for 1 year, scoped to Company B UK).

---

### B. Role-Based Navigation & Redirect Targets

Upon signing in, users are automatically directed to their dedicated role workspace:

| Persona | Sign-In Method | Post-Login Redirect URL | Target Screen Overview |
| :--- | :--- | :--- | :--- |
| **Merchandiser** | 1-Click Quick-Fill or `merchandiser@company-a.com` | `http://localhost:5173/orders` | **Merchandiser Order Board & Command Center:** Factory-wide PO status cards (Green/Amber/Red), TNA milestone setup, run-rate delay math, AI issue review gate, What-If recovery simulator, and weekly PDF/Excel status exports. |
| **Floor Supervisor** | 1-Click Quick-Fill or `supervisor.muthu@company-a.com` | `http://localhost:5173/supervisor/my-work` | **Supervisor Mobile Floor View:** High-contrast, mobile-first interface (`max-width: 480px`), quick-tap increment chips (`+50`, `+100`), native Tamil voice logging, and offline sync queue. |
| **Buyer B (UK)** | 1-Click Quick-Fill or Magic Link | `http://localhost:5173/buyer-portal` | **Company B Buyer Portal:** Strictly isolated read-only view of Company B export orders (`B-PO-88213`, `B-PO-88240`), displaying only merchandiser-confirmed warnings and approved photos. |
| **Buyer C (Germany)** | 1-Click Quick-Fill or `compliance@company-c.de` | `http://localhost:5173/buyer-portal` | **Company C Buyer Portal:** Strictly isolated view of Company C export orders (`C-PO-0488`). Zero access to Company B data. |

---

## 3. Pre-Configured Demo Credentials

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
| `POST` | `/api/v1/auth/login` | Public | Validates credentials; sets 7-day `refreshToken` HttpOnly cookie and returns 15-minute `accessToken`. |
| `POST` | `/api/v1/auth/refresh` | Cookie | Reads HttpOnly `refreshToken` and re-issues a fresh 15-minute `accessToken`. |
| `POST` | `/api/v1/auth/logout` | Public | Clears the `refreshToken` cookie and terminates the session. |
| `GET` | `/api/v1/auth/me` | Bearer Token | Returns current authenticated user profile, assigned unit, and tenant scope. |
| `GET` | `/api/v1/auth/magic-link/:token` | Public | Validates cryptographic magic link token and authenticates buyer directly. |
| `GET` | `/api/v1/health` | Public | Returns `{ status: "ok", timestamp: "..." }`. |
