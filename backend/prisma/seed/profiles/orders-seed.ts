import { PrismaClient, Stage, RiskLevel, ApprovalStatus, GatePassStatus, IssueCategory, AuditCategory, Role } from '@prisma/client';
import crypto from 'crypto';
import { CalibratedOrderFixture } from '../types';
import { SeededMasterEntities } from './master-seed';
import { SeedStorageHelper } from '../storage-helper';

export interface ExtendedDailyLog {
  dateOffsetDays: number;
  completedQty: number;
  reworkQty: number;
  rejectedQty: number;
  stage: Stage;
  unitCode: string;
  userEmail: string;
  shift: string;
  operatorNotes: string;
  machineLine?: string;
  issueCategory?: IssueCategory;
  rawTamilText?: string;
  translatedText?: string;
  audioFileUrl?: string;
  voiceDurationSeconds?: number;
}

export interface ExtendedPhoto {
  caption: string;
  category: string;
  mimeType: string;
  fileName: string;
  stage?: Stage;
  isBuyerVisible?: boolean;
}

export interface ExtendedRiskMitigation {
  actionType: string;
  description: string;
  addedDailyCapacity: number;
  estimatedCostRupees: number;
  authorizedByEmail: string;
  offsetDays?: number;
}

export interface ExtendedAuditEvent {
  action: string;
  category: AuditCategory;
  reasonCode: string;
  notes: string;
  previousValue?: string;
  newValue?: string;
  financialImpactRupees?: number;
  currency?: string;
  userEmail: string;
  role: Role;
  offsetDays: number;
}

export interface FullOrderFixture extends CalibratedOrderFixture {
  dailyLogs: ExtendedDailyLog[];
  photos?: ExtendedPhoto[];
  mitigationActions?: ExtendedRiskMitigation[];
  orderAuditTrail?: ExtendedAuditEvent[];
}

export class OrdersSeedRunner {
  static async run(
    prisma: PrismaClient,
    orders: FullOrderFixture[],
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

      const totalOrderValue = fixture.totalQuantity * fixture.fobPricePerPiece * fixture.exchangeRate;
      const orderDate = new Date(anchorDate);
      orderDate.setDate(orderDate.getDate() - 45);

      // 1. Upsert Order
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
          status: (fixture as any).status || 'ACTIVE',
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
          orderDate,
          exFactoryDate: new Date(fixture.exFactoryDateStr),
          buyerId: buyer.id,
          unitId: unit.id,
          status: (fixture as any).status || 'ACTIVE',
        },
      });
      ordersSeeded++;

      // 2. Upsert Order Lines with realistic completed quantities
      const activeMilestone =
        fixture.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        fixture.milestones[fixture.milestones.length - 1];
      const activeCompleted = activeMilestone?.completedQuantity || 0;
      const overallRatio = fixture.totalQuantity > 0 ? activeCompleted / fixture.totalQuantity : 0;

      const orderLinesByCombo = new Map<string, any>();
      for (const line of fixture.orderLines) {
        const lineCompletedQty = Math.min(line.plannedQty, Math.round(line.plannedQty * overallRatio));

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
        orderLinesByCombo.set(`${line.size}-${line.color}`, orderLine);
      }

      // 3. Upsert Milestones
      const milestonesByStage = new Map<Stage, any>();
      for (const ms of fixture.milestones) {
        // One product is handled by one unit — all milestones belong to the order's unit
        const msUnit = unit;
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

      // 4. Seed Daily Production Updates, Breakdowns & Issue Classifications
      const createdUpdates: any[] = [];
      for (let logIdx = 0; logIdx < fixture.dailyLogs.length; logIdx++) {
        const log = fixture.dailyLogs[logIdx];
        const logUnit = unit;
        const logUser = master.usersByEmail.get(log.userEmail) || master.usersByEmail.get('merchandiser@threadflow.com')!;
        const logMilestone = milestonesByStage.get(log.stage) || milestonesByStage.values().next().value;
        const logDate = new Date(anchorDate);
        logDate.setDate(logDate.getDate() + log.dateOffsetDays);

        const idempKey = `idemp_${fixture.poNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}_d${log.dateOffsetDays}_${logIdx}_${log.completedQty}`;

        const update = await prisma.productionUpdate.upsert({
          where: { idempotencyKey: idempKey },
          update: {
            goodQuantity: log.completedQty,
            rejectedQuantity: log.rejectedQty,
            notes: log.operatorNotes,
            shift: log.shift.includes('Night') ? 'NIGHT' : 'DAY',
            machineLine: log.machineLine || `${logUnit.code} Line 1`,
            audioFileUrl: log.audioFileUrl || null,
            voiceDurationSeconds: log.voiceDurationSeconds || null,
            clientEventAt: logDate,
            receivedAt: logDate,
          },
          create: {
            idempotencyKey: idempKey,
            orderId: order.id,
            milestoneId: logMilestone.id,
            supervisorId: logUser.id,
            stage: log.stage,
            goodQuantity: log.completedQty,
            rejectedQuantity: log.rejectedQty,
            notes: log.operatorNotes,
            shift: log.shift.includes('Night') ? 'NIGHT' : 'DAY',
            machineLine: log.machineLine || `${logUnit.code} Line 1`,
            audioFileUrl: log.audioFileUrl || null,
            voiceDurationSeconds: log.voiceDurationSeconds || null,
            clientEventAt: logDate,
            receivedAt: logDate,
            approvalStatus: ApprovalStatus.CONFIRMED,
          },
        });
        createdUpdates.push({ update, log });
        logsSeeded++;

        // Add size breakdown lines for this production update across all sizes
        const linesList = Array.from(orderLinesByCombo.values());
        if (linesList.length > 0) {
          const piecesPerLine = Math.floor(log.completedQty / linesList.length);
          const rejectedPerLine = Math.floor(log.rejectedQty / linesList.length);
          for (let lIdx = 0; lIdx < linesList.length; lIdx++) {
            const lineObj = linesList[lIdx];
            const isLast = lIdx === linesList.length - 1;
            const lineGood = isLast ? log.completedQty - piecesPerLine * (linesList.length - 1) : piecesPerLine;
            const lineRej = isLast ? log.rejectedQty - rejectedPerLine * (linesList.length - 1) : rejectedPerLine;

            await prisma.productionUpdateLine.upsert({
              where: {
                productionUpdateId_orderLineId: {
                  productionUpdateId: update.id,
                  orderLineId: lineObj.id,
                },
              },
              update: {
                goodQuantity: lineGood,
                rejectedQuantity: lineRej,
              },
              create: {
                productionUpdateId: update.id,
                orderLineId: lineObj.id,
                goodQuantity: lineGood,
                rejectedQuantity: lineRej,
              },
            });
          }
        }

        // Attach Semantic Issue Classification if log has disruption
        if (log.issueCategory) {
          await prisma.issueClassification.upsert({
            where: { productionUpdateId: update.id },
            update: {
              category: log.issueCategory,
              confidenceScore: 0.94,
              rawTamilText: log.rawTamilText || log.operatorNotes,
              translatedText: log.translatedText || log.operatorNotes,
              needsReview: false,
              isConfirmed: true,
            },
            create: {
              productionUpdateId: update.id,
              category: log.issueCategory,
              confidenceScore: 0.94,
              rawTamilText: log.rawTamilText || log.operatorNotes,
              translatedText: log.translatedText || log.operatorNotes,
              needsReview: false,
              isConfirmed: true,
              classifiedBy: 'AI-Gemini-Tamil',
            },
          });
        }
      }

      // 5. Attach Photo Evidence across Updates
      if (fixture.photos && fixture.photos.length > 0 && createdUpdates.length > 0) {
        for (let pIdx = 0; pIdx < fixture.photos.length; pIdx++) {
          const photo = fixture.photos[pIdx];
          const targetUpdate = createdUpdates[pIdx % createdUpdates.length].update;
          const storageMeta = SeedStorageHelper.generateAssetMetadata(photo.fileName, photo.mimeType, fixture.poNumber);

          const existingPhoto = await prisma.productionPhoto.findFirst({
            where: {
              productionUpdateId: targetUpdate.id,
              s3Url: storageMeta.publicUrl,
            },
          });

          if (!existingPhoto) {
            await prisma.productionPhoto.create({
              data: {
                productionUpdateId: targetUpdate.id,
                s3Url: storageMeta.publicUrl,
                stage: photo.stage || targetUpdate.stage,
                approvalStatus: ApprovalStatus.CONFIRMED,
                isBuyerVisible: photo.isBuyerVisible ?? true,
              },
            });
          }
        }
      }

      // 6. Upsert Risk Warnings & Mitigation Actions
      let createdRiskWarningId: string | null = null;
      if (fixture.riskWarnings && fixture.riskWarnings.length > 0) {
        for (const rw of fixture.riskWarnings) {
          const rwMilestone = milestonesByStage.get(rw.stage) || milestonesByStage.values().next().value;
          const daysLate = rw.projectedCompletionDaysLate;
          const projectedDate = new Date(anchorDate);
          projectedDate.setDate(projectedDate.getDate() + daysLate);

          const existingWarning = await prisma.riskWarning.findFirst({
            where: {
              orderId: order.id,
              milestoneId: rwMilestone.id,
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
            approvalStatus: rw.approvalStatus || ApprovalStatus.CONFIRMED,
            isBuyerVisible: rw.isBuyerVisible,
          };

          if (existingWarning) {
            const updated = await prisma.riskWarning.update({
              where: { id: existingWarning.id },
              data: warningData,
            });
            createdRiskWarningId = updated.id;
          } else {
            const created = await prisma.riskWarning.create({
              data: {
                orderId: order.id,
                milestoneId: rwMilestone.id,
                ...warningData,
              },
            });
            createdRiskWarningId = created.id;
          }
          warningsSeeded++;
        }
      }

      // 7. Seed Risk Mitigation Actions if present
      if (fixture.mitigationActions && fixture.mitigationActions.length > 0 && createdRiskWarningId) {
        for (const ma of fixture.mitigationActions) {
          const authUser = master.usersByEmail.get(ma.authorizedByEmail) || master.usersByEmail.get('merchandiser@threadflow.com')!;
          const maDate = new Date(anchorDate);
          maDate.setDate(maDate.getDate() + (ma.offsetDays || 0));

          await prisma.riskMitigationAction.create({
            data: {
              riskWarningId: createdRiskWarningId,
              actionType: ma.actionType,
              description: ma.description,
              addedDailyCapacity: ma.addedDailyCapacity,
              estimatedCostRupees: ma.estimatedCostRupees,
              authorizedById: authUser.id,
              createdAt: maDate,
            },
          });
        }
      }

      // 8. Upsert Subcontract Gate Passes
      if (fixture.gatePasses && fixture.gatePasses.length > 0) {
        for (const gp of fixture.gatePasses) {
          const gpUnit = master.unitsByCode.get(gp.destinationUnitCode) || unit;
          const gpMilestone = milestonesByStage.get(gp.stage) || milestonesByStage.values().next().value;
          const outwardDate = new Date(anchorDate);
          outwardDate.setDate(outwardDate.getDate() + gp.outwardOffsetDays);

          const expectedDate = new Date(anchorDate);
          expectedDate.setDate(expectedDate.getDate() + gp.expectedReturnOffsetDays);

          const returnedDate =
            gp.actualReturnOffsetDays !== undefined
              ? (() => {
                  const d = new Date(anchorDate);
                  d.setDate(d.getDate() + gp.actualReturnOffsetDays);
                  return d;
                })()
              : null;

          await prisma.subcontractGatePass.upsert({
            where: { gatePassNumber: gp.passNumber },
            update: {
              dispatchedQty: gp.quantityDispatched,
              receivedQty: gp.quantityReturned || 0,
              status: gp.status,
              expectedReturnAt: expectedDate,
              actualReturnedAt: returnedDate,
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
              actualReturnedAt: returnedDate,
              status: gp.status,
              notes: gp.notes || `Vehicle: ${gp.vehicleNumber}`,
              challanDocUrl: `https://assets.threadflow.app/challans/${gp.passNumber}.pdf`,
            },
          });
        }
      }

      // 9. Seed Comprehensive Audit Trail for this Order
      if (fixture.orderAuditTrail && fixture.orderAuditTrail.length > 0) {
        for (const ev of fixture.orderAuditTrail) {
          const evUser = master.usersByEmail.get(ev.userEmail) || master.usersByEmail.get('merchandiser@threadflow.com')!;
          const evDate = new Date(anchorDate);
          evDate.setDate(evDate.getDate() + ev.offsetDays);

          const hash = crypto
            .createHash('sha256')
            .update(`${order.id}-${ev.action}-${ev.reasonCode}-${evDate.toISOString()}`)
            .digest('hex');

          await prisma.auditEvent.create({
            data: {
              entityType: 'Order',
              entityId: order.id,
              orderId: order.id,
              userId: evUser.id,
              userRole: ev.role,
              category: ev.category,
              action: ev.action,
              reasonCode: ev.reasonCode,
              notes: ev.notes,
              previousValue: ev.previousValue || null,
              newValue: ev.newValue || null,
              financialImpactRupees: ev.financialImpactRupees || null,
              currency: ev.currency || 'INR',
              auditHash: hash,
              timestamp: evDate,
              ipAddress: '192.168.1.104',
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ThreadFlow/1.0',
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
