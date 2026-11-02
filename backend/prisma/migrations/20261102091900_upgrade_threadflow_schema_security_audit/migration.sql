-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('DATE_CHANGE', 'FINANCIAL_IMPACT', 'RISK_STATUS_CHANGE', 'OVERTIME_AUTHORIZATION', 'PRICE_UPDATE', 'STAGE_OUTPUT', 'ACCESS_CONTROL', 'GATE_PASS_EVENT', 'DISCOUNT_PENALTY');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('DISPATCHED', 'PARTIAL_RECEIVED', 'COMPLETED', 'OVERDUE');

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "auditHash" TEXT,
ADD COLUMN     "category" "AuditCategory" NOT NULL DEFAULT 'DATE_CHANGE',
ADD COLUMN     "currency" TEXT DEFAULT 'INR',
ADD COLUMN     "financialImpactRupees" DOUBLE PRECISION,
ADD COLUMN     "userRole" "Role" NOT NULL DEFAULT 'SUPERVISOR';

-- AlterTable
ALTER TABLE "buyer_magic_links" ADD COLUMN     "tokenHash" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "encryptedFobPrice" TEXT,
ADD COLUMN     "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "totalOrderValue" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "production_updates" ADD COLUMN     "machineLine" TEXT,
ADD COLUMN     "shift" TEXT DEFAULT 'DAY';

-- CreateTable
CREATE TABLE "production_update_lines" (
    "id" TEXT NOT NULL,
    "productionUpdateId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "goodQuantity" INTEGER NOT NULL,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_update_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_mitigation_actions" (
    "id" TEXT NOT NULL,
    "riskWarningId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "addedDailyCapacity" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostRupees" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "authorizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_mitigation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontract_gate_passes" (
    "id" TEXT NOT NULL,
    "gatePassNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "dispatchedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnAt" TIMESTAMP(3) NOT NULL,
    "actualReturnedAt" TIMESTAMP(3),
    "status" "GatePassStatus" NOT NULL DEFAULT 'DISPATCHED',
    "challanDocUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcontract_gate_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_update_lines_productionUpdateId_idx" ON "production_update_lines"("productionUpdateId");

-- CreateIndex
CREATE INDEX "production_update_lines_orderLineId_idx" ON "production_update_lines"("orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "production_update_lines_productionUpdateId_orderLineId_key" ON "production_update_lines"("productionUpdateId", "orderLineId");

-- CreateIndex
CREATE INDEX "risk_mitigation_actions_riskWarningId_idx" ON "risk_mitigation_actions"("riskWarningId");

-- CreateIndex
CREATE INDEX "risk_mitigation_actions_authorizedById_idx" ON "risk_mitigation_actions"("authorizedById");

-- CreateIndex
CREATE UNIQUE INDEX "subcontract_gate_passes_gatePassNumber_key" ON "subcontract_gate_passes"("gatePassNumber");

-- CreateIndex
CREATE INDEX "subcontract_gate_passes_orderId_idx" ON "subcontract_gate_passes"("orderId");

-- CreateIndex
CREATE INDEX "subcontract_gate_passes_milestoneId_idx" ON "subcontract_gate_passes"("milestoneId");

-- CreateIndex
CREATE INDEX "subcontract_gate_passes_unitId_idx" ON "subcontract_gate_passes"("unitId");

-- CreateIndex
CREATE INDEX "subcontract_gate_passes_status_idx" ON "subcontract_gate_passes"("status");

-- CreateIndex
CREATE INDEX "audit_events_category_idx" ON "audit_events"("category");

-- CreateIndex
CREATE INDEX "audit_events_userRole_idx" ON "audit_events"("userRole");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_magic_links_tokenHash_key" ON "buyer_magic_links"("tokenHash");

-- CreateIndex
CREATE INDEX "buyer_magic_links_tokenHash_idx" ON "buyer_magic_links"("tokenHash");

-- AddForeignKey
ALTER TABLE "production_update_lines" ADD CONSTRAINT "production_update_lines_productionUpdateId_fkey" FOREIGN KEY ("productionUpdateId") REFERENCES "production_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_update_lines" ADD CONSTRAINT "production_update_lines_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_mitigation_actions" ADD CONSTRAINT "risk_mitigation_actions_riskWarningId_fkey" FOREIGN KEY ("riskWarningId") REFERENCES "risk_warnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_mitigation_actions" ADD CONSTRAINT "risk_mitigation_actions_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontract_gate_passes" ADD CONSTRAINT "subcontract_gate_passes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontract_gate_passes" ADD CONSTRAINT "subcontract_gate_passes_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "tna_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontract_gate_passes" ADD CONSTRAINT "subcontract_gate_passes_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
