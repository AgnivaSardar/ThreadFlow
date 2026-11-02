import { PrismaClient, Stage, RiskLevel, ApprovalStatus, GatePassStatus } from '@prisma/client';
import { CalibratedOrderFixture } from '../types';
import { SeededMasterEntities } from './master-seed';
import { SeedStorageHelper } from '../storage-helper';

export class OrdersSeedRunner {
  static async run(
    prisma: PrismaClient,
    orders: CalibratedOrderFixture[],
    master: SeededMasterEntities,
    anchorDate: Date,
    verbose = false
  ): Promise<{ ordersSeeded: number; logsSeeded: number; warningsSeeded: number }> {
    let ordersSeeded = 0;
    let logsSeeded = 0;
    let warningsSeeded = 0;

    for (const fixture of orders) {
      const buyer = master.buyersByCode.get(fixture.buyerCode);
      const unit = master.unitsByCode.get(fixture.unitCode);

      if (!buyer) throw new Error(`Unknown buyer code: ${fixture.buyerCode}`);
      if (!unit) throw new Error(`Unknown unit code: ${fixture.unitCode}`);

      // 1. Upsert Order
      const totalOrderValue = fixture.totalQuantity * fixture.fobPricePerPiece * fixture.exchangeRate;
      const order = await prisma.order.upsert({
        where: { poNumber: fixture.poNumber },
        update: {
          style: fixture.style,
          description: fixture.description,
          totalQuantity: fixture.totalQuantity,
          currency: fixture.currency,
          exchangeRate: fixture.exchangeRate,
          fobPricePerPiece: fixture.fobPricePerPiece,
          totalOrderValue,
          exFactoryDate: new Date(fixture.exFactoryDateStr),
          buyerId: buyer.id,
          unitId: unit.id,
        },
        create: {
          poNumber: fixture.poNumber,
          style: fixture.style,
          description: fixture.description,
          totalQuantity: fixture.totalQuantity,
          currency: fixture.currency,
          exchangeRate: fixture.exchangeRate,
          fobPricePerPiece: fixture.fobPricePerPiece,
          totalOrderValue,
          orderDate: new Date('2026-09-15T00:00:00Z'),
          exFactoryDate: new Date(fixture.exFactoryDateStr),
          buyerId: buyer.id,
          unitId: unit.id,
        },
      });
      ordersSeeded++;

      // 2. Upsert Order Lines with realistic completed quantities
      // Find active milestone progress to calibrate line completion
      const activeMilestone =
        fixture.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        fixture.milestones[fixture.milestones.length - 1];
      const activeCompleted = activeMilestone?.completedQuantity || 0;
      const overallRatio = fixture.totalQuantity > 0 ? activeCompleted / fixture.totalQuantity : 0;

      const orderLinesByCombo = new Map<string, string>();
      for (const line of fixture.orderLines) {
        let lineCompletedQty = 0;
        if (fixture.poNumber === 'B-PO-88240') {
          // Calibrated size skew fixture: XL lags significantly behind (Anti-99% Done Trap)
          if (line.size === 'XL') lineCompletedQty = 400; // 33%
          else if (line.size === 'S') lineCompletedQty = 1150; // 72%
          else if (line.size === 'M') lineCompletedQty = 1950; // 70%
          else if (line.size === 'L') lineCompletedQty = 1700; // 71%
          else lineCompletedQty = Math.round(line.plannedQty * overallRatio);
        } else {
          lineCompletedQty = Math.min(line.plannedQty, Math.round(line.plannedQty * overallRatio));
        }

        const orderLine = await prisma.orderLine.upsert({
          where: {
            orderId_size_color: {
              orderId: order.id,
              size: line.size,
              color: line.color,
            },
          },
          update: {
            plannedQty: line.plannedQty,
            completedQty: lineCompletedQty,
          },
          create: {
            orderId: order.id,
            size: line.size,
            color: line.color,
            plannedQty: line.plannedQty,
            completedQty: lineCompletedQty,
          },
        });
        orderLinesByCombo.set(`${line.size}-${line.color}`, orderLine.id);
      }

      // 3. Upsert Milestones
      const milestonesByStage = new Map<Stage, any>();
      for (const ms of fixture.milestones) {
        const msUnit = master.unitsByCode.get(ms.unitCode) || unit;
        const plannedStart = new Date(anchorDate);
        plannedStart.setDate(plannedStart.getDate() + ms.plannedStartOffsetDays);

        const plannedEnd = new Date(anchorDate);
        plannedEnd.setDate(plannedEnd.getDate() + ms.plannedEndOffsetDays);

        const milestone = await prisma.tnaMilestone.upsert({
          where: {
            orderId_stage: {
              orderId: order.id,
              stage: ms.stage,
            },
          },
          update: {
            sequenceOrder: ms.sequenceOrder,
            plannedStart,
            plannedEnd,
            bufferDaysAhead: ms.bufferDaysAhead,
            targetQuantity: ms.targetQuantity,
            completedQuantity: ms.completedQuantity,
            unitId: msUnit.id,
          },
          create: {
            orderId: order.id,
            stage: ms.stage,
            sequenceOrder: ms.sequenceOrder,
            plannedStart,
            plannedEnd,
            bufferDaysAhead: ms.bufferDaysAhead,
            targetQuantity: ms.targetQuantity,
            completedQuantity: ms.completedQuantity,
            unitId: msUnit.id,
          },
        });
        milestonesByStage.set(ms.stage, milestone);
      }

      // 4. Seed Daily Production Updates & Photos
      let lastUpdateId: string | null = null;
      let lastUpdateStage: Stage = fixture.milestones[fixture.milestones.length - 1].stage;

      for (let logIdx = 0; logIdx < fixture.dailyLogs.length; logIdx++) {
        const log = fixture.dailyLogs[logIdx];
        const logUnit = master.unitsByCode.get(log.unitCode) || unit;
        const logUser = master.usersByEmail.get(log.userEmail) || master.usersByEmail.get('merchandiser@company-a.com')!;
        const logMilestone = milestonesByStage.get(log.stage);
        const logDate = new Date(anchorDate);
        logDate.setDate(logDate.getDate() + log.dateOffsetDays);

        const idempKey = `idemp_${fixture.poNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}_d${log.dateOffsetDays}_${logIdx}_${log.completedQty}`;

        // Upsert daily production update idempotently
        const update = await prisma.productionUpdate.upsert({
          where: { idempotencyKey: idempKey },
          update: {
            goodQuantity: log.completedQty,
            rejectedQuantity: log.rejectedQty,
            notes: log.operatorNotes,
            shift: log.shift.includes('Night') ? 'NIGHT' : 'DAY',
            clientEventAt: logDate,
          },
          create: {
            idempotencyKey: idempKey,
            orderId: order.id,
            milestoneId: logMilestone?.id,
            supervisorId: logUser.id,
            stage: log.stage,
            goodQuantity: log.completedQty,
            rejectedQuantity: log.rejectedQty,
            notes: log.operatorNotes,
            shift: log.shift.includes('Night') ? 'NIGHT' : 'DAY',
            machineLine: `${logUnit.code} Floor Line`,
            clientEventAt: logDate,
            receivedAt: logDate,
            approvalStatus: ApprovalStatus.CONFIRMED,
          },
        });
        lastUpdateId = update.id;
        lastUpdateStage = log.stage;
        logsSeeded++;

        // Add size breakdown lines if order has lines
        const firstLineId = orderLinesByCombo.values().next().value;
        if (firstLineId) {
          await prisma.productionUpdateLine.upsert({
            where: {
              productionUpdateId_orderLineId: {
                productionUpdateId: update.id,
                orderLineId: firstLineId,
              },
            },
            update: {
              goodQuantity: log.completedQty,
              rejectedQuantity: log.rejectedQty,
            },
            create: {
              productionUpdateId: update.id,
              orderLineId: firstLineId,
              goodQuantity: log.completedQty,
              rejectedQuantity: log.rejectedQty,
            },
          });
        }
      }

      // 5. Attach Photo Evidence with Cloud Storage Checksums & Blurhashes
      if (fixture.photos && fixture.photos.length > 0 && lastUpdateId) {
        for (const photo of fixture.photos) {
          const storageMeta = SeedStorageHelper.generateAssetMetadata(photo.fileName, photo.mimeType, fixture.poNumber);

          const existingPhoto = await prisma.productionPhoto.findFirst({
            where: {
              productionUpdateId: lastUpdateId,
              s3Url: storageMeta.publicUrl,
            },
          });

          if (!existingPhoto) {
            await prisma.productionPhoto.create({
              data: {
                productionUpdateId: lastUpdateId,
                s3Url: storageMeta.publicUrl,
                stage: lastUpdateStage,
                approvalStatus: ApprovalStatus.CONFIRMED,
                isBuyerVisible: true,
              },
            });
          }
        }
      }

      // 6. Upsert Risk Warnings
      if (fixture.riskWarnings && fixture.riskWarnings.length > 0) {
        for (const rw of fixture.riskWarnings) {
          const rwMilestone = milestonesByStage.get(rw.stage);
          const daysLate = rw.projectedCompletionDaysLate;
          const projectedDate = new Date(anchorDate);
          projectedDate.setDate(projectedDate.getDate() + daysLate);

          const existingWarning = await prisma.riskWarning.findFirst({
            where: {
              orderId: order.id,
              milestoneId: rwMilestone?.id,
            },
          });

          const warningData = {
            riskLevel: rw.riskLevel,
            requiredDailyRate: rw.requiredDailyRate,
            actualRollingRate: rw.actualRollingRate,
            varianceQtyPerDay: rw.varianceQtyPerDay,
            projectedCompletionDate: projectedDate,
            daysLate,
            financialExposureRupees: rw.financialExposureRupees,
            mathBreakdown: typeof rw.mathBreakdown === 'string' ? rw.mathBreakdown : JSON.stringify(rw.mathBreakdown),
            mitigationPlan: rw.mitigationPlan,
            approvalStatus: rw.approvalStatus || ApprovalStatus.PENDING_REVIEW,
            isBuyerVisible: rw.isBuyerVisible,
          };

          if (existingWarning) {
            await prisma.riskWarning.update({
              where: { id: existingWarning.id },
              data: warningData,
            });
          } else {
            await prisma.riskWarning.create({
              data: {
                orderId: order.id,
                milestoneId: rwMilestone?.id,
                ...warningData,
              },
            });
          }
          warningsSeeded++;
        }
      }

      // 7. Upsert Gate Passes
      if (fixture.gatePasses && fixture.gatePasses.length > 0) {
        for (const gp of fixture.gatePasses) {
          const gpUnit = master.unitsByCode.get(gp.destinationUnitCode) || unit;
          const gpMilestone = milestonesByStage.get(gp.stage) || milestonesByStage.values().next().value;
          const outwardDate = new Date(anchorDate);
          outwardDate.setDate(outwardDate.getDate() + gp.outwardOffsetDays);

          const expectedDate = new Date(anchorDate);
          expectedDate.setDate(expectedDate.getDate() + gp.expectedReturnOffsetDays);

          await prisma.subcontractGatePass.upsert({
            where: { gatePassNumber: gp.passNumber },
            update: {
              dispatchedQty: gp.quantityDispatched,
              receivedQty: gp.quantityReturned || 0,
              status: gp.status,
            },
            create: {
              gatePassNumber: gp.passNumber,
              orderId: order.id,
              milestoneId: gpMilestone.id,
              unitId: gpUnit.id,
              dispatchedQty: gp.quantityDispatched,
              receivedQty: gp.quantityReturned || 0,
              dispatchedAt: outwardDate,
              expectedReturnAt: expectedDate,
              status: gp.status,
              notes: `Vehicle: ${gp.vehicleNumber}`,
            },
          });
        }
      }

      if (verbose) {
        console.log(`[OrdersSeed] Seeded PO ${fixture.poNumber} (${fixture.style})`);
      }
    }

    return { ordersSeeded, logsSeeded, warningsSeeded };
  }
}
