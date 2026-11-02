# Production Risk Engine — "Show-Your-Math" Formulation

## 1. Mathematical Formulas

### Required Daily Rate
$$\text{Required Daily Rate} = \frac{\text{Stage Target Quantity} - \text{Cumulative Completed Quantity}}{\text{Working Days Left Until Ex-Factory (excl. Sundays)} - \text{Downstream Buffer Days}}$$

### Actual Rolling Run-Rate (3-Day Weighted Moving Average)
$$\text{Actual Rolling Rate} = (\text{Day}_1 \times 0.50) + (\text{Day}_2 \times 0.30) + (\text{Day}_3 \times 0.20)$$

### Daily Variance
$$\text{Variance} = \text{Actual Rolling Rate} - \text{Required Daily Rate}$$

## 2. Downstream Stage Buffer Awareness
In knitwear, stages are strictly dependent:
`KNITTING (18d)` $\rightarrow$ `DYEING/WASHING (14d)` $\rightarrow$ `PRINTING (11d)` $\rightarrow$ `CUTTING (9d)` $\rightarrow$ `STITCHING (3d)` $\rightarrow$ `CHECKING (2d)` $\rightarrow$ `FINISHING (0d)`.

When evaluating an order at **Printing** (`C-PO-0488`), deducting 11 downstream buffer days ensures that Stitching (6d) and Finishing (3d) are not starved.

## 3. Thresholds & Risk Level States
- **RED**: Projected completion date > Ex-Factory Date ($>0$ days late). Flags **₹3.5 Lakh air freight escalation risk**.
- **AMBER**: Projected on time, but buffer $<2$ days, OR variance $<0$, OR subcontracted unit with no update for $>48$ hours. Flags **₹1.05 Lakh 5% late penalty discount**.
- **GREEN**: Projected on time with $\ge 2$ days safety buffer and positive variance.

## 4. Financial Exposure Calculation
- **5% Late Delivery Discount:** Contractual penalty for missing shipment cutoff by 1–2 days.
  $$\text{Exposure} = \text{Order Quantity} \times \text{FOB Price (avg. ₹350)} \times 0.05 \approx \mathbf{₹1,05,000}$$
- **Air Freight Escalation:** Triggered when marine container cut-off is missed to prevent retail cancellation.
  $$\text{Exposure} = \text{Gross Weight} \times \text{Tariff} \approx \mathbf{₹3,50,000}$$
- **Order Board "₹ At Risk" Header:** Real-time aggregation of financial exposure across all Red and Amber orders.
