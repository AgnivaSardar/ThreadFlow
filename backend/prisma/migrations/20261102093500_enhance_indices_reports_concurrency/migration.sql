-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "production_updates" ADD COLUMN     "audioFileUrl" TEXT,
ADD COLUMN     "voiceDurationSeconds" INTEGER;

-- AlterTable
ALTER TABLE "tna_milestones" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "weekly_buyer_reports" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "fileFormat" TEXT NOT NULL DEFAULT 'PDF',
    "reportUrl" TEXT NOT NULL,
    "summarySnapshot" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_buyer_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_buyer_reports_buyerId_idx" ON "weekly_buyer_reports"("buyerId");

-- CreateIndex
CREATE INDEX "weekly_buyer_reports_year_weekNumber_idx" ON "weekly_buyer_reports"("year", "weekNumber");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");

-- CreateIndex
CREATE INDEX "production_photos_productionUpdateId_isBuyerVisible_idx" ON "production_photos"("productionUpdateId", "isBuyerVisible");

-- CreateIndex
CREATE INDEX "production_updates_milestoneId_clientEventAt_idx" ON "production_updates"("milestoneId", "clientEventAt" DESC);

-- CreateIndex
CREATE INDEX "production_updates_orderId_clientEventAt_idx" ON "production_updates"("orderId", "clientEventAt" DESC);

-- CreateIndex
CREATE INDEX "risk_warnings_orderId_approvalStatus_isBuyerVisible_idx" ON "risk_warnings"("orderId", "approvalStatus", "isBuyerVisible");

-- CreateIndex
CREATE INDEX "tna_milestones_deletedAt_idx" ON "tna_milestones"("deletedAt");

-- AddForeignKey
ALTER TABLE "weekly_buyer_reports" ADD CONSTRAINT "weekly_buyer_reports_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Industrial Integrity CHECK Constraints
ALTER TABLE "order_lines" ADD CONSTRAINT "chk_completed_qty_non_negative" CHECK ("completedQty" >= 0);
ALTER TABLE "tna_milestones" ADD CONSTRAINT "chk_milestone_dates" CHECK ("plannedEnd" >= "plannedStart");
ALTER TABLE "tna_milestones" ADD CONSTRAINT "chk_target_qty_positive" CHECK ("targetQuantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "chk_total_qty_positive" CHECK ("totalQuantity" > 0);
ALTER TABLE "production_updates" ADD CONSTRAINT "chk_good_qty_non_negative" CHECK ("goodQuantity" >= 0);
ALTER TABLE "production_updates" ADD CONSTRAINT "chk_rejected_qty_non_negative" CHECK ("rejectedQuantity" >= 0);
