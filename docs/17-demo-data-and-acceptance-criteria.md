# Calibrated Demo Data & Acceptance Criteria

**Simulated Factory "Today" Anchor:** `2026-11-02`

## 1. Calibrated Core Orders

### Order 1: `B-PO-88240` (High Urgency — RED)
- **Buyer:** Company B (UK)
- **Style:** Men's Pique Polo White (8,000 pcs)
- **Current Stage:** Finishing (Unit 1)
- **Status:** Completed 5,200 pcs, **2,800 pcs remaining**
- **Ex-Factory Date:** `2026-11-12` (9 working days left, excl. Sundays)
- **Required Rate:** $2,800 \div 9 = \mathbf{311\text{ pcs/day}}$
- **Actual Rolling Rate:** $\mathbf{200\text{ pcs/day}}$ (Deficit: -111 pcs/day)
- **Risk Level:** 🔴 **RED** (Projected completion: `2026-11-17`, 5 days late)
- **Financial Exposure:** **₹3,50,000 Air Freight Risk**

### Order 2: `C-PO-0488` (2-Week Early Warning — AMBER)
- **Buyer:** Company C (Germany)
- **Style:** Kids Printed Tee Yellow (10,000 pcs)
- **Current Stage:** Printing (Subcontract - PrintTex)
- **Status:** Completed 3,100 pcs, **6,900 pcs remaining**
- **Ex-Factory Date:** `2026-11-28` (23 working days left)
- **Downstream Buffer:** 11 days (Cutting 2d + Stitching 6d + Finishing 3d)
- **Effective Working Days:** $23 - 11 = \mathbf{12\text{ days}}$
- **Required Rate:** $6,900 \div 12 = \mathbf{575\text{ pcs/day}}$
- **Actual Rolling Rate:** $\mathbf{450\text{ pcs/day}}$ (Deficit: -125 pcs/day)
- **Risk Level:** 🟡 **AMBER** (2-week early warning before stitching starvation)
- **Financial Exposure:** **₹1,05,000 5% Late Discount Risk**

### Order 3: `B-PO-88213` (Healthy Schedule — GREEN)
- **Buyer:** Company B (UK)
- **Style:** Crew Neck Tee Navy (12,000 pcs)
- **Current Stage:** Stitching (Unit 2)
- **Status:** Completed 6,800 pcs, **5,200 pcs remaining**
- **Ex-Factory Date:** `2026-11-20` (16 working days left)
- **Effective Working Days:** $16 - 3\text{ (Finishing buffer)} = \mathbf{13\text{ days}}$
- **Required Rate:** $5,200 \div 13 = \mathbf{400\text{ pcs/day}}$
- **Actual Rolling Rate:** $\mathbf{420\text{ pcs/day}}$ (+20 pcs/day safety margin)
- **Risk Level:** 🟢 **GREEN** (Projected completion: `2026-11-18`, 2 days safety margin)
- **Financial Exposure:** **₹0**

## Additional Orders (Active Factory Breadth)
- `B-PO-88255`: Company B, Brushed Fleece Hoodie, 5,000 pcs, Cutting (Unit 3) — GREEN
- `C-PO-0492`: Company C, Organic Rib Tank, 6,000 pcs, Dyeing (WashTex) — AMBER (>48h subcontractor delay)
- `B-PO-88260`: Company B, Mercerized Cotton Tee, 15,000 pcs, Knitting (Unit 1) — GREEN
- `C-PO-0501`: Company C, Striped Interlock Polo, 7,500 pcs, Checking (Unit 2) — RED
- `B-PO-88272`: Company B, Waffle Knit Henley, 4,200 pcs, Finishing (Unit 3) — GREEN
