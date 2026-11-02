# Data Model and Consistency

## Core Entities
- **User**: `id`, `email`, `name`, `passwordHash`, `role` (`MERCHANDISER`, `SUPERVISOR`, `BUYER`, `ADMIN`), `phone`, `languagePreference` (`ta` / `en`).
- **Buyer**: `id`, `name`, `code` (`COMPANY_B`, `COMPANY_C`), `country`, `contactEmail`.
- **Unit**: `id`, `name`, `code`, `type` (`OWN_UNIT`, `SUBCONTRACTOR`), `location`.
- **Order**: `id`, `poNumber` (unique), `buyerId`, `style`, `totalQuantity`, `exFactoryDate`, `unitId`, `status`.
- **OrderLine**: `id`, `orderId`, `color`, `size` (`S`, `M`, `L`, `XL`), `plannedQty`, `completedQty`.
- **TnaMilestone**: `id`, `orderId`, `stage` (`KNITTING` -> `DYEING_WASHING` -> `PRINTING` -> `CUTTING` -> `STITCHING` -> `CHECKING` -> `FINISHING`), `sequenceOrder`, `plannedStart`, `plannedEnd`, `targetQuantity`, `completedQuantity`, `bufferDaysAhead`.
- **ProductionUpdate**: `id`, `idempotencyKey` (@unique), `orderId`, `milestoneId`, `supervisorId`, `goodQuantity`, `rejectedQuantity`, `notes`, `audioTranscript`, `clientEventAt`, `receivedAt`, `approvalStatus` (`PENDING_REVIEW`, `CONFIRMED`, `OVERRIDDEN`), `confirmedBy`, `confirmedAt`, `overrideNotes`.
- **ProductionPhoto**: `id`, `productionUpdateId`, `url`, `caption`, `stage`, `approvalStatus` (`PENDING_REVIEW`, `CONFIRMED`, `OVERRIDDEN`), `isBuyerVisible` (default: false).
- **RiskWarning**: `id`, `orderId`, `milestoneId`, `riskLevel` (`GREEN`, `AMBER`, `RED`), `requiredDailyRate`, `actualRollingRate`, `varianceQtyPerDay`, `projectedCompletionDate`, `daysLate`, `financialExposureRupees`, `reasonSummary`, `mathBreakdown`, `approvalStatus` (`PENDING_REVIEW`, `CONFIRMED`, `OVERRIDDEN`), `isBuyerVisible` (default: false).
- **IssueClassification**: `id`, `productionUpdateId`, `rawText`, `translatedEnglish`, `category` (`MACHINE_BREAKDOWN`, `POWER_OUTAGE`, `FABRIC_DEFECT`, `SUBCONTRACTOR_DELAY`, `LABOUR_SHORTAGE`, `QUALITY_HOLD`, `OTHER`), `confidenceScore`, `needsReview`, `isConfirmed`.
- **AuditEvent**: `id`, `entityType`, `entityId`, `action`, `reasonCode` (mandatory), `previousValue`, `newValue`, `userId`, `timestamp`.
- **BuyerMagicLink**: `id`, `buyerId`, `token` (unique), `expiresAt`, `isActive`.

## Consistency & Factory Floor Invariants
1. **Idempotency Enforcement:** `idempotencyKey` UUID generated client-side ensures duplicate network transmissions in Tiruppur dead zones do not duplicate production numbers.
2. **Upstream-Downstream Stage Dependency Invariant:**
   $$\text{Cumulative Stage Quantity} \le \text{Previous Stage Completed Quantity}$$
   Prevents accidental entry of finishing units before stitching has completed.
3. **Cutting Allowance Tolerance Ceiling:**
   $$\text{Cumulative Stage Quantity} \le \text{Total PO Quantity} \times 1.03$$
   Guards against typos (e.g. entering 52,000 instead of 5,200) by strictly capping output at Tiruppur's standard 3% cutting tolerance.
4. **Subcontractor Inactivity Sentinel:**
   If a unit is tagged as `SUBCONTRACTOR` and receives no update for >48 hours, automatically trigger an `AMBER` alert for merchandiser follow-up.
5. **Human-in-the-Loop Buyer Gate:**
   `ProductionUpdate` and `RiskWarning` require explicit merchandiser confirmation before `isBuyerVisible` becomes `true`.
