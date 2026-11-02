# Data Model, Consistency, Auditing & High-Availability Architecture

## 1. Core Relational Entities (Using Collision-Resistant K-Sortable CUIDs)

All primary keys use **CUID** (`@default(cuid())`), providing URL-safe, time-ordered, collision-resistant identifiers that eliminate sequential enumeration risks (German Tank problem) and prevent B-Tree index fragmentation under high-frequency factory floor writes.

### Entity Definitions & Relational Schema
* **`User`**:
  * Fields: `id`, `email`, `passwordHash`, `name`, `role` (`MERCHANDISER`, `SUPERVISOR`, `BUYER`, `ADMIN`), `languagePreference` (`ta` / `en`), `phone`, `buyerId` (optional FK -> `Buyer`), `assignedUnitId` (optional FK -> `Unit`).
  * Enforces least-privilege scoping across factory floor supervisors, merchandisers, and external buying agents.
* **`Buyer`**:
  * Fields: `id`, `name`, `code` (`COMPANY_B`, `COMPANY_C`), `country`, `contactEmail`.
  * Serves as the primary tenant boundary for multi-tenant isolation.
* **`Unit`**:
  * Fields: `id`, `name`, `code`, `type` (`OWN_UNIT`, `SUBCONTRACTOR`), `location`.
  * Manages owned Tiruppur manufacturing units (Unit 1, Unit 2, Unit 3) and external partner units (PrintTex, WashTex).
* **`Order`**:
  * Fields: `id`, `poNumber` (unique), `style`, `description`, `totalQuantity`, `currency` (`INR`, `GBP`, `EUR`), `exchangeRate`, `fobPricePerPiece`, `encryptedFobPrice` (AES-256-GCM ciphertext), `totalOrderValue`, `exFactoryDate`, `orderDate`, `status`, `buyerId` (FK), `unitId` (FK).
* **`OrderLine`**:
  * Fields: `id`, `orderId` (FK), `size` (`S`, `M`, `L`, `XL`), `color`, `plannedQty`, `completedQty`.
  * Compound constraint: `@@unique([orderId, size, color])`.
* **`ProductionUpdateLine`** *(Industrial Upgrade)*:
  * Fields: `id`, `productionUpdateId` (FK), `orderLineId` (FK), `goodQuantity`, `rejectedQuantity`.
  * Directly solves the *"99% Done Size-Ratio Skew Trap"* by recording shift output by size and color.
* **`TnaMilestone`**:
  * Fields: `id`, `orderId` (FK), `stage` (`KNITTING` -> `DYEING_WASHING` -> `PRINTING` -> `CUTTING` -> `STITCHING` -> `CHECKING` -> `FINISHING`), `sequenceOrder` (1–7), `plannedStart`, `plannedEnd`, `bufferDaysAhead`, `targetQuantity`, `completedQuantity`, `unitId` (FK).
  * Enforces sequential progression and knitwear buffer deduction rules.
* **`ProductionUpdate`**:
  * Fields: `id`, `idempotencyKey` (@unique client UUID), `orderId` (FK), `milestoneId` (FK), `supervisorId` (FK), `stage`, `shift` (`DAY` / `NIGHT`), `machineLine`, `goodQuantity`, `rejectedQuantity`, `notes`, `clientEventAt`, `receivedAt`, `approvalStatus` (`PENDING_REVIEW`, `CONFIRMED`, `OVERRIDDEN`), `confirmedBy`, `confirmedAt`.
* **`ProductionPhoto`**:
  * Fields: `id`, `productionUpdateId` (FK), `s3Url`, `stage`, `approvalStatus`, `isBuyerVisible` (default: `false`).
* **`RiskWarning`**:
  * Fields: `id`, `orderId` (FK), `milestoneId` (FK), `riskLevel` (`GREEN`, `AMBER`, `RED`), `requiredDailyRate`, `actualRollingRate`, `varianceQtyPerDay`, `projectedCompletionDate`, `daysLate`, `financialExposureRupees`, `mathBreakdown` (JSON string), `mitigationPlan`, `approvalStatus`, `isBuyerVisible` (default: `false`), `reviewedById`, `reviewedAt`.
* **`RiskMitigationAction`** *(Industrial Upgrade)*:
  * Fields: `id`, `riskWarningId` (FK), `actionType` (`AUTHORIZE_OVERTIME`, `ADD_STITCHING_LINE`, `SPLIT_SUBCONTRACT`), `description`, `addedDailyCapacity` (pcs/day), `estimatedCostRupees` (money auditing), `authorizedById` (FK), `createdAt`.
* **`SubcontractGatePass`** *(Industrial Upgrade)*:
  * Fields: `id`, `gatePassNumber` (unique), `orderId` (FK), `milestoneId` (FK), `unitId` (FK), `dispatchedQty`, `receivedQty`, `dispatchedAt`, `expectedReturnAt`, `actualReturnedAt`, `status` (`DISPATCHED`, `PARTIAL_RECEIVED`, `COMPLETED`, `OVERDUE`), `challanDocUrl`, `notes`.
* **`IssueClassification`**:
  * Fields: `id`, `productionUpdateId` (unique FK), `category` (`MACHINE_BREAKDOWN`, `POWER_OUTAGE`, `FABRIC_DEFECT`, `SUBCONTRACTOR_DELAY`, `LABOUR_SHORTAGE`, `QUALITY_HOLD`, `OTHER`), `confidenceScore`, `needsReview`, `isConfirmed`, `rawTamilText`, `translatedText`, `classifiedBy`.
* **`AuditEvent`** *(Role-Wise & Financial Auditing)*:
  * Fields: `id`, `entityType`, `entityId`, `action`, `category` (`DATE_CHANGE`, `FINANCIAL_IMPACT`, `RISK_STATUS_CHANGE`, `OVERTIME_AUTHORIZATION`, `PRICE_UPDATE`, `STAGE_OUTPUT`, `ACCESS_CONTROL`, `GATE_PASS_EVENT`, `DISCOUNT_PENALTY`), `reasonCode` (mandatory), `notes`, `previousValue` (JSON), `newValue` (JSON), `financialImpactRupees`, `currency`, `auditHash` (SHA-256 tamper-evident chain), `userId` (FK), `userRole` (acting role), `orderId` (FK), `timestamp`, `ipAddress`, `userAgent`.
* **`BuyerMagicLink`**:
  * Fields: `id`, `token` (unique), `tokenHash` (unique SHA-256 hash for secure verification), `buyerId` (FK), `expiresAt`, `isActive`, `lastUsedAt`.

---

## 2. Factory Floor Invariants & Consistency Rules

1. **Anti-Double Count Idempotency:**
   `ProductionUpdate.idempotencyKey` carries a `@unique` database index. When low-end floor smartphones reconnect after Tiruppur network drops, the backend detects the duplicate UUID and returns HTTP `200 OK` without double-incrementing completed counts.
2. **Upstream-Downstream Stage Dependency Invariant:**
   $$\text{Cumulative Stage Output}_{\text{Stage } N} \le \text{Cumulative Completed Output}_{\text{Stage } N-1}$$
   A supervisor cannot enter 4,000 units in **Finishing** if **Stitching** has only completed 3,200 units.
3. **Cutting Allowance Tolerance Ceiling:**
   $$\text{Cumulative Stage Quantity} \le \text{Total PO Quantity} \times 1.03$$
   Prevents catastrophic typographical slips (e.g., entering 65,000 instead of 6,500) by strictly capping input at Tiruppur's standard 3% cutting tolerance.
4. **Subcontractor Gate Pass Sentinel:**
   If a milestone assigned to an external partner unit (`type: SUBCONTRACTOR`) is open and its associated `SubcontractGatePass` status exceeds `expectedReturnAt` without receipt, the system automatically marks it `OVERDUE` and escalates the order to `AMBER`.
5. **Human-in-the-Loop Buyer Gate:**
   Neither raw supervisor panic notes nor unconfirmed delay alerts are visible to foreign buyers. `isBuyerVisible` strictly defaults to `false` and can only be flipped to `true` when a merchandiser confirms the alert with an approved mitigation plan.

---

## 3. Multi-Layer Security & Field-Level Encryption

To guarantee data confidentiality and regulatory compliance:
* **AES-256-GCM Field Encryption:**
  Sensitive commercial fields (`Order.encryptedFobPrice`, supervisor phone numbers) are encrypted in the application layer before reaching PostgreSQL storage using 96-bit random IVs and 128-bit authentication tags.
* **Token Hashing (Zero Plaintext Tokens at Rest):**
  Single-use buyer magic links store only a cryptographic **SHA-256 hash** (`tokenHash`) in PostgreSQL. The unhashed raw token is delivered strictly to the authorized foreign buyer's email/link.
* **Role-Wise Financial Auditing:**
  Every modification that carries commercial impact (e.g. ex-factory delivery date shifts triggering 5% discounts or ₹3.5 Lakh air freight escalations, overtime authorizations) records `financialImpactRupees`, `currency`, the acting user's `userRole`, mandatory `reasonCode`, and a cryptographic `auditHash`.

---

## 4. High-Availability (HA), Replication & Disaster Recovery

* **Primary-Replica Architecture:**
  * **Primary Node (`DATABASE_URL`):** Dedicated to fast, ACID transaction writes, supervisor shift submissions, and transactional consistency locks.
  * **Read Replica Node (`REPLICA_DATABASE_URL`):** Handles heavy asynchronous jobs (PDF/Excel buyer report generation, long-range trend charting, buyer read-only browsing).
* **Physical Streaming Replication with Zero Data Loss:**
  * Configured via PostgreSQL WAL streaming (`synchronous_commit = on`, `wal_level = replica`).
  * Continuous WAL archiving via **pgBackRest / WAL-G** pushing to encrypted S3 object storage ensures **Point-In-Time Recovery (PITR)** to any second during outages.
* **Automated Standby Promotion:**
  * Under orchestrators (e.g., Patroni with `etcd`), a primary hardware or network failure triggers automated health-check failover: promoting the synchronous standby to primary within 10 seconds with zero downtime for factory floor workers.
