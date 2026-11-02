-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MERCHANDISER', 'SUPERVISOR', 'BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('OWN_UNIT', 'SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('KNITTING', 'DYEING_WASHING', 'PRINTING', 'CUTTING', 'STITCHING', 'CHECKING', 'FINISHING');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('MACHINE_BREAKDOWN', 'POWER_OUTAGE', 'FABRIC_DEFECT', 'SUBCONTRACTOR_DELAY', 'LABOUR_SHORTAGE', 'QUALITY_HOLD', 'OTHER');

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "UnitType" NOT NULL DEFAULT 'OWN_UNIT',
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SUPERVISOR',
    "languagePreference" TEXT NOT NULL DEFAULT 'ta',
    "phone" TEXT,
    "buyerId" TEXT,
    "assignedUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "description" TEXT,
    "totalQuantity" INTEGER NOT NULL,
    "fobPricePerPiece" DOUBLE PRECISION,
    "exFactoryDate" TIMESTAMP(3) NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "buyerId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "plannedQty" INTEGER NOT NULL,
    "completedQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tna_milestones" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "bufferDaysAhead" INTEGER NOT NULL DEFAULT 0,
    "targetQuantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tna_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_updates" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "goodQuantity" INTEGER NOT NULL,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "clientEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_photos" (
    "id" TEXT NOT NULL,
    "productionUpdateId" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isBuyerVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_warnings" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "requiredDailyRate" DOUBLE PRECISION NOT NULL,
    "actualRollingRate" DOUBLE PRECISION NOT NULL,
    "varianceQtyPerDay" DOUBLE PRECISION NOT NULL,
    "projectedCompletionDate" TIMESTAMP(3),
    "daysLate" INTEGER NOT NULL,
    "financialExposureRupees" DOUBLE PRECISION NOT NULL,
    "mathBreakdown" TEXT NOT NULL,
    "mitigationPlan" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isBuyerVisible" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_classifications" (
    "id" TEXT NOT NULL,
    "productionUpdateId" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "rawTamilText" TEXT,
    "translatedText" TEXT,
    "classifiedBy" TEXT DEFAULT 'AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "notes" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_magic_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buyers_code_key" ON "buyers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_buyerId_idx" ON "users"("buyerId");

-- CreateIndex
CREATE INDEX "users_assignedUnitId_idx" ON "users"("assignedUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_poNumber_key" ON "orders"("poNumber");

-- CreateIndex
CREATE INDEX "orders_buyerId_idx" ON "orders"("buyerId");

-- CreateIndex
CREATE INDEX "orders_unitId_idx" ON "orders"("unitId");

-- CreateIndex
CREATE INDEX "orders_exFactoryDate_idx" ON "orders"("exFactoryDate");

-- CreateIndex
CREATE INDEX "order_lines_orderId_idx" ON "order_lines"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_lines_orderId_size_color_key" ON "order_lines"("orderId", "size", "color");

-- CreateIndex
CREATE INDEX "tna_milestones_orderId_idx" ON "tna_milestones"("orderId");

-- CreateIndex
CREATE INDEX "tna_milestones_stage_idx" ON "tna_milestones"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "tna_milestones_orderId_stage_key" ON "tna_milestones"("orderId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "tna_milestones_orderId_sequenceOrder_key" ON "tna_milestones"("orderId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "production_updates_idempotencyKey_key" ON "production_updates"("idempotencyKey");

-- CreateIndex
CREATE INDEX "production_updates_orderId_idx" ON "production_updates"("orderId");

-- CreateIndex
CREATE INDEX "production_updates_milestoneId_idx" ON "production_updates"("milestoneId");

-- CreateIndex
CREATE INDEX "production_updates_supervisorId_idx" ON "production_updates"("supervisorId");

-- CreateIndex
CREATE INDEX "production_updates_approvalStatus_idx" ON "production_updates"("approvalStatus");

-- CreateIndex
CREATE INDEX "production_updates_clientEventAt_idx" ON "production_updates"("clientEventAt");

-- CreateIndex
CREATE INDEX "production_photos_productionUpdateId_idx" ON "production_photos"("productionUpdateId");

-- CreateIndex
CREATE INDEX "production_photos_isBuyerVisible_idx" ON "production_photos"("isBuyerVisible");

-- CreateIndex
CREATE INDEX "production_photos_approvalStatus_idx" ON "production_photos"("approvalStatus");

-- CreateIndex
CREATE INDEX "risk_warnings_orderId_idx" ON "risk_warnings"("orderId");

-- CreateIndex
CREATE INDEX "risk_warnings_milestoneId_idx" ON "risk_warnings"("milestoneId");

-- CreateIndex
CREATE INDEX "risk_warnings_riskLevel_idx" ON "risk_warnings"("riskLevel");

-- CreateIndex
CREATE INDEX "risk_warnings_approvalStatus_idx" ON "risk_warnings"("approvalStatus");

-- CreateIndex
CREATE INDEX "risk_warnings_isBuyerVisible_idx" ON "risk_warnings"("isBuyerVisible");

-- CreateIndex
CREATE UNIQUE INDEX "issue_classifications_productionUpdateId_key" ON "issue_classifications"("productionUpdateId");

-- CreateIndex
CREATE INDEX "issue_classifications_category_idx" ON "issue_classifications"("category");

-- CreateIndex
CREATE INDEX "issue_classifications_needsReview_idx" ON "issue_classifications"("needsReview");

-- CreateIndex
CREATE INDEX "issue_classifications_isConfirmed_idx" ON "issue_classifications"("isConfirmed");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit_events"("userId");

-- CreateIndex
CREATE INDEX "audit_events_orderId_idx" ON "audit_events"("orderId");

-- CreateIndex
CREATE INDEX "audit_events_timestamp_idx" ON "audit_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_magic_links_token_key" ON "buyer_magic_links"("token");

-- CreateIndex
CREATE INDEX "buyer_magic_links_token_idx" ON "buyer_magic_links"("token");

-- CreateIndex
CREATE INDEX "buyer_magic_links_buyerId_idx" ON "buyer_magic_links"("buyerId");

-- CreateIndex
CREATE INDEX "buyer_magic_links_isActive_expiresAt_idx" ON "buyer_magic_links"("isActive", "expiresAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assignedUnitId_fkey" FOREIGN KEY ("assignedUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tna_milestones" ADD CONSTRAINT "tna_milestones_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tna_milestones" ADD CONSTRAINT "tna_milestones_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_updates" ADD CONSTRAINT "production_updates_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_updates" ADD CONSTRAINT "production_updates_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "tna_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_updates" ADD CONSTRAINT "production_updates_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_photos" ADD CONSTRAINT "production_photos_productionUpdateId_fkey" FOREIGN KEY ("productionUpdateId") REFERENCES "production_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_warnings" ADD CONSTRAINT "risk_warnings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_warnings" ADD CONSTRAINT "risk_warnings_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "tna_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_classifications" ADD CONSTRAINT "issue_classifications_productionUpdateId_fkey" FOREIGN KEY ("productionUpdateId") REFERENCES "production_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_magic_links" ADD CONSTRAINT "buyer_magic_links_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
