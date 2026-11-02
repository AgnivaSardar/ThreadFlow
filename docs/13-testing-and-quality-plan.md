# Testing and Quality Assurance Plan

## 1. Focused Automated Test Suites

### Suite A: Run-Rate Risk Engine (`risk.engine.test.ts`)
- **Sunday Exclusion:** Validates working-day calendar counting (e.g. 14 calendar days spanning two Sundays = 12 working days).
- **3-Day Weighted Average:** Tests weights `0.50`, `0.30`, `0.20` across fluctuating supervisor entries.
- **Stage Lead-Time Buffer:** Confirms 11-day buffer deduction for `PRINTING` stage.
- **Mathematical Transparency:** Verifies all fields of `mathBreakdown` match manual calculations.
- **Financial Exposure:** Asserts ₹3.5L for RED status and ₹1.05L for AMBER status.

### Suite B: Multi-Tenant Buyer Isolation (`buyer.isolation.test.ts`)
- Authenticate as Company B (UK).
- Asserts `GET /api/v1/buyer-portal/orders` returns only Company B orders (`B-PO-88213`, `B-PO-88240`).
- Asserts direct requests to `GET /api/v1/buyer-portal/orders/:cPo0488Id` return `403 Forbidden` or `404 Not Found`.
- Asserts unapproved photos and unconfirmed warnings (`approvalStatus: PENDING_REVIEW`) are strictly excluded.

### Suite C: Tamil AI Fallback & Human Gate (`ai.fallback.test.ts`)
- Simulates LLM timeout and HTTP 500 error.
- Asserts automatic activation of deterministic local Tamil dictionary.
- Asserts low confidence (<0.65) notes trigger `needsReview: true`.
- Asserts warnings remain hidden from buyers until merchandiser issues confirmation.

## 2. Floor Edge Case Verification
- **Size Ratio Skew:** Flags warning when one size lags >20% behind average progress.
- **Anti-Finger-Slip Guardrail:** Prevents logging stage output greater than upstream completed units or >103% total PO.
- **Subcontractor Overdue Alert:** Triggers AMBER when subcontractor records no update for >48 hours.
