# Problem statement and requirements

## Client context
A Tiruppur knitwear exporter operates three own production units and uses subcontracted printing/washing partners. The business has about 900 workers and 35 office staff, processes roughly 500 orders annually, and currently tracks orders in spreadsheets, calls, email, and WhatsApp.

## Business impact supplied in the brief
- Late shipment rate: 8% (about 40 of 500 orders).
- Air freight: 15 orders × ₹3.5 lakh = ₹52.5 lakh.
- Discounts: 25 orders × ₹1.05 lakh = ₹26.25 lakh.
- Status chasing: 12 merchandisers × 2 hours/day; stated annual estimate ₹28.8 lakh.
- Estimated combined annual impact: approximately ₹1.08 crore.

Treat these as client-provided estimates, not independently audited figures.

## Core requirements
1. Create orders with PO, buyer, style, colour, size quantities, ex-factory date, unit, and TNA milestones.
2. Let supervisors submit daily stage quantities, photos, and text/voice issue notes from phones.
3. Show each order as green, amber, or red against its plan.
4. Detect projected delays early and explain the calculation.
5. Give buyers a read-only view of their own orders and approved photos.
6. Export weekly buyer updates to PDF/Excel.
7. Preserve date-change and approval history.

## Roles
- Merchandiser: order/TNA management, review risk, confirm/dismiss alerts, reports.
- Supervisor: update assigned production stages and upload evidence.
- Buyer: read-only access to their own approved information.

## Out of scope
Costing, invoicing/export documents, fabric inventory, attendance, and payroll.
