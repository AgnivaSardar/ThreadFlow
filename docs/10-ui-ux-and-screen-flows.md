# UI/UX and Screen Flows Architecture

## 1. Visual Theme & Style Direction (Light Theme Specification)
* **Canvas Theme:** **Light Theme Only** with soft off-white canvas (`#F4F7FB`) and pure white elevated surface cards (`#FFFFFF`).
* **Sidebar Navigation:** Deep Midnight Navy (`#0C2D48`) with amber/yellow active link accent indicators (`#F59E0B`).
* **Typography:** `Inter`, accessible contrast, tabular numerals for quantities and financial values, generous whitespace, and Tamil-capable font fallbacks.
* **Component Cards:** Rounded 16px corners (`rounded-2xl`), subtle borders (`border-slate-100`), soft elevation shadows.
* **Status Badges:** Pastel pill tags:
  * Green: `#ECFDF5` bg with `#047857` text.
  * Amber: `#FFFBEB` bg with `#B45309` text.
  * Red: `#FEF2F2` bg with `#B91C1C` text.
  * In Progress: `#F0F9FF` bg with `#0369A1` text.

---

## 2. Primary Screen Flows

1. **Operations Overview & Command Center (`/orders`):**
   * Top 4 Metric Stat Cards (Total Export Volume, On-Schedule POs, Warnings Count, ₹ At Risk Across Factory).
   * 3-Day Run-Rate Spline Chart (actual daily output vs required daily line rate).
   * Stage Distribution Donut Chart (Knitting, Dyeing, Printing, Cutting, Stitching, Finishing).
   * Master Orders Table with buyer filter pills, stage progress bars, and status cards.
2. **Order Setup & TNA Milestones (`/orders/new`):**
   * PO details, style description, FOB price per piece, ex-factory target date.
   * Size/Color breakdown grid (S, M, L, XL).
   * Automated sequential TNA milestone generator with downstream knitwear buffer deductions.
3. **Supervisor Floor Mobile Experience (`/supervisor/my-work`):**
   * High-contrast, touch-optimized card layout (`max-width: 480px`).
   * One-tap quick increment buttons (`+50`, `+100`, `+250`, `+500`).
   * One-touch Tamil visual issue chips (⚡ மின்வெட்டு, 🪡 ஊசி உடைவு, 🧵 துணி பழுது).
   * Native Tamil voice logging with Web Speech API audio transcription.
   * Client-side canvas photo compression (~85 KB WebP) and offline queue sync.
4. **Human-in-the-Loop Risk Review & Mitigation (`/risk`):**
   * Review cards showing raw supervisor Tamil notes, AI reason classification, and confidence score.
   * "Show-Your-Math" run-rate breakdown modal (Daily required rate vs rolling WMA).
   * Merchandiser Confirmation Gate: Promotes alert to buyer-visible only after mitigation plan approval.
   * "What-If" Recovery Simulator drawer for testing overtime and capacity adjustments.
5. **Buyer Portal (`/buyer-portal`):**
   * Multi-tenant isolated workspace strictly scoped to authenticated buyer (`buyerId`).
   * Ex-factory dates, verified milestones, approved stage photos, and confirmed mitigation plans.
   * Clean, brand-tailored view with zero access to competing foreign brand POs.
6. **Compliance Audit History (`/audit`):**
   * Immutable log of all delivery date changes, reason codes, price modifications, and diff snapshots with cryptographic SHA-256 integrity hashes.
7. **Weekly Buyer Reports (`/reports`):**
   * Historical PDF and Excel status export snapshots categorized by buyer, year, and shipping week.

---

## 3. Dual-Persona Responsive Architecture
* **Merchandiser Desktop View:** Multi-column high information density dashboard layout with left navigation sidebar and split analytics grid.
* **Supervisor Mobile Floor View:** Framed at `max-width: 480px` for Android smartphones (2–3 GB RAM), massive tap targets (`min-height: 54px`), zero nested menus, high touch contrast.
