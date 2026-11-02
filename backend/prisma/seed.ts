import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Role,
  UnitType,
  Stage,
  RiskLevel,
  ApprovalStatus,
  IssueCategory,
  AuditCategory,
  GatePassStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// Simulated Today Anchor: 2026-11-02
const ANCHOR_DATE = new Date('2026-11-02T10:00:00Z');

// Standard Downstream Buffer Days for Tiruppur Knitwear
const KNITWEAR_BUFFERS: Record<Stage, number> = {
  KNITTING: 18,
  DYEING_WASHING: 14,
  PRINTING: 11,
  CUTTING: 9,
  STITCHING: 3,
  CHECKING: 2,
  FINISHING: 0,
};

// Stage Sequence (1 to 7)
const STAGE_SEQUENCE: Stage[] = [
  Stage.KNITTING,
  Stage.DYEING_WASHING,
  Stage.PRINTING,
  Stage.CUTTING,
  Stage.STITCHING,
  Stage.CHECKING,
  Stage.FINISHING,
];

async function main() {
  console.log('[Seed] Starting complete calibrated database seed (Simulated Date: 2026-11-02)...');

  // ==========================================
  // 1. CLEAN EXISTING DATA (Safe Cascading Order)
  // ==========================================
  console.log('[Seed] Step 1: Cleaning previous records...');
  await prisma.productionUpdateLine.deleteMany();
  await prisma.productionPhoto.deleteMany();
  await prisma.issueClassification.deleteMany();
  await prisma.riskMitigationAction.deleteMany();
  await prisma.subcontractGatePass.deleteMany();
  await prisma.weeklyBuyerReport.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.riskWarning.deleteMany();
  await prisma.productionUpdate.deleteMany();
  await prisma.tnaMilestone.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.buyerMagicLink.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.buyer.deleteMany();
  console.log('[Seed] Cleaned existing database records.');

  // ==========================================
  // 2. SEED BUYERS
  // ==========================================
  console.log('[Seed] Step 2: Seeding Buyers...');
  const buyerB = await prisma.buyer.create({
    data: {
      name: 'Company B (UK)',
      code: 'COMPANY_B',
      country: 'United Kingdom',
      contactEmail: 'buyer@company-b.co.uk',
    },
  });

  const buyerC = await prisma.buyer.create({
    data: {
      name: 'Company C (Germany)',
      code: 'COMPANY_C',
      country: 'Germany',
      contactEmail: 'compliance@company-c.de',
    },
  });

  // ==========================================
  // 3. SEED MANUFACTURING & SUBCONTRACT UNITS
  // ==========================================
  console.log('[Seed] Step 3: Seeding Units...');
  const unit1 = await prisma.unit.create({
    data: {
      name: 'Unit 1 (Cotton Hub - Own)',
      code: 'UNIT_1',
      type: UnitType.OWN_UNIT,
      location: 'Avinashi Road, Tiruppur',
    },
  });

  const unit2 = await prisma.unit.create({
    data: {
      name: 'Unit 2 (Stitching Hub - Own)',
      code: 'UNIT_2',
      type: UnitType.OWN_UNIT,
      location: 'Palladam Road, Tiruppur',
    },
  });

  const unit3 = await prisma.unit.create({
    data: {
      name: 'Unit 3 (Specialty - Own)',
      code: 'UNIT_3',
      type: UnitType.OWN_UNIT,
      location: 'Angeripalayam, Tiruppur',
    },
  });

  const printTex = await prisma.unit.create({
    data: {
      name: 'Subcontract - PrintTex',
      code: 'PRINTTEX',
      type: UnitType.SUBCONTRACTOR,
      location: 'Industrial Estate, Tiruppur',
    },
  });

  const washTex = await prisma.unit.create({
    data: {
      name: 'Subcontract - WashTex',
      code: 'WASHTEX',
      type: UnitType.SUBCONTRACTOR,
      location: 'Dharapuram Road, Tiruppur',
    },
  });

  // ==========================================
  // 4. SEED AUTHENTICATED USERS (Password: ThreadFlow@2026)
  // ==========================================
  console.log('[Seed] Step 4: Seeding Authenticated Users...');
  const passwordHash = await bcrypt.hash('ThreadFlow@2026', 10);

  const merchandiser = await prisma.user.create({
    data: {
      email: 'merchandiser@company-a.com',
      passwordHash,
      name: 'Ramesh Merchandiser',
      role: Role.MERCHANDISER,
      languagePreference: 'en',
      phone: '+91 98422 10001',
    },
  });

  const supervisorMuthu = await prisma.user.create({
    data: {
      email: 'supervisor.muthu@company-a.com',
      passwordHash,
      name: 'Muthu Floor Supervisor',
      role: Role.SUPERVISOR,
      languagePreference: 'ta',
      phone: '+91 98422 20002',
      assignedUnitId: unit1.id,
    },
  });

  const supervisorSelvam = await prisma.user.create({
    data: {
      email: 'supervisor.selvam@company-a.com',
      passwordHash,
      name: 'Selvam Floor Supervisor',
      role: Role.SUPERVISOR,
      languagePreference: 'ta',
      phone: '+91 98422 30003',
      assignedUnitId: unit2.id,
    },
  });

  const buyerUserB = await prisma.user.create({
    data: {
      email: 'buyer@company-b.co.uk',
      passwordHash,
      name: 'Sarah Jenkins (UK Sourcing)',
      role: Role.BUYER,
      buyerId: buyerB.id,
      languagePreference: 'en',
    },
  });

  const buyerUserC = await prisma.user.create({
    data: {
      email: 'compliance@company-c.de',
      passwordHash,
      name: 'Klaus Mueller (EU Compliance)',
      role: Role.BUYER,
      buyerId: buyerC.id,
      languagePreference: 'en',
    },
  });

  // Helper to generate full sequential TNA Milestones
  async function createTnaMilestones(
    orderId: string,
    totalQty: number,
    orderDate: Date,
    exFactoryDate: Date,
    currentStage: Stage,
    completedQtyAtCurrentStage: number,
    primaryUnitId: string
  ) {
    const milestonesMap: Record<Stage, any> = {} as any;
    const totalSpanMs = exFactoryDate.getTime() - orderDate.getTime();
    const stageDurationMs = totalSpanMs / 7;

    for (let i = 0; i < STAGE_SEQUENCE.length; i++) {
      const stage = STAGE_SEQUENCE[i];
      const seq = i + 1;
      const plannedStart = new Date(orderDate.getTime() + i * stageDurationMs);
      const plannedEnd = new Date(orderDate.getTime() + (i + 1) * stageDurationMs);
      const buffer = KNITWEAR_BUFFERS[stage];

      let completed = 0;
      const currentIndex = STAGE_SEQUENCE.indexOf(currentStage);
      if (i < currentIndex) {
        // Earlier stages completed 100%
        completed = totalQty;
      } else if (i === currentIndex) {
        completed = completedQtyAtCurrentStage;
      } else {
        completed = 0;
      }

      // Unit assignment logic
      let assignedUnit = primaryUnitId;
      if (stage === Stage.PRINTING) assignedUnit = printTex.id;
      if (stage === Stage.DYEING_WASHING) assignedUnit = washTex.id;

      const m = await prisma.tnaMilestone.create({
        data: {
          orderId,
          stage,
          sequenceOrder: seq,
          plannedStart,
          plannedEnd,
          bufferDaysAhead: buffer,
          targetQuantity: totalQty,
          completedQuantity: completed,
          unitId: assignedUnit,
        },
      });
      milestonesMap[stage] = m;
    }
    return milestonesMap;
  }

  // ==========================================
  // 5. SEED ORDER 1: B-PO-88240 (🔴 RED - Air Freight Risk)
  // ==========================================
  console.log('[Seed] Step 5: Seeding Order 1 (B-PO-88240 - 🔴 RED)...');
  const order1 = await prisma.order.create({
    data: {
      poNumber: 'B-PO-88240',
      buyerId: buyerB.id,
      unitId: unit1.id,
      style: "Men's Polo White",
      description: '100% Pique Cotton 220 GSM with Rib Collar and 2-button placket',
      totalQuantity: 8000,
      fobPricePerPiece: 350.0,
      totalOrderValue: 2800000.0,
      exFactoryDate: new Date('2026-11-12T18:00:00Z'),
      orderDate: new Date('2026-10-01T08:00:00Z'),
      status: 'ACTIVE',
    },
  });

  // Size breakdown: S: 1600, M: 2800, L: 2400, XL: 1200
  const o1LineS = await prisma.orderLine.create({
    data: { orderId: order1.id, size: 'S', color: 'Optic White', plannedQty: 1600, completedQty: 1040 },
  });
  const o1LineM = await prisma.orderLine.create({
    data: { orderId: order1.id, size: 'M', color: 'Optic White', plannedQty: 2800, completedQty: 1820 },
  });
  const o1LineL = await prisma.orderLine.create({
    data: { orderId: order1.id, size: 'L', color: 'Optic White', plannedQty: 2400, completedQty: 1560 },
  });
  const o1LineXL = await prisma.orderLine.create({
    data: { orderId: order1.id, size: 'XL', color: 'Optic White', plannedQty: 1200, completedQty: 780 },
  });

  const o1Milestones = await createTnaMilestones(
    order1.id,
    8000,
    new Date('2026-10-01T08:00:00Z'),
    new Date('2026-11-12T18:00:00Z'),
    Stage.FINISHING,
    5200,
    unit1.id
  );

  // 3 Daily Logs for Order 1: Oct 31 (220 pcs), Nov 1 (190 pcs), Nov 2 (200 pcs)
  // WMA = (200*0.50) + (190*0.30) + (220*0.20) = 100 + 57 + 44 = 201 ≈ 200 pcs/day
  // Available days = 9 working days (excluding Sunday Nov 8).
  // Required rate = 2800 / 9 = 311.1 pcs/day. Deficit = -111 pcs/day.
  const o1Update1 = await prisma.productionUpdate.create({
    data: {
      idempotencyKey: 'idemp_b88240_20261031_001',
      orderId: order1.id,
      milestoneId: o1Milestones[Stage.FINISHING].id,
      supervisorId: supervisorMuthu.id,
      stage: Stage.FINISHING,
      shift: 'DAY',
      machineLine: 'Finishing Line 1',
      goodQuantity: 220,
      rejectedQuantity: 12,
      notes: 'Buttonhole attachment slow due to motor issue',
      clientEventAt: new Date('2026-10-31T17:30:00Z'),
      receivedAt: new Date('2026-10-31T17:31:00Z'),
      approvalStatus: ApprovalStatus.CONFIRMED,
      confirmedBy: merchandiser.name,
      confirmedAt: new Date('2026-10-31T18:15:00Z'),
    },
  });

  const o1Update2 = await prisma.productionUpdate.create({
    data: {
      idempotencyKey: 'idemp_b88240_20261101_002',
      orderId: order1.id,
      milestoneId: o1Milestones[Stage.FINISHING].id,
      supervisorId: supervisorMuthu.id,
      stage: Stage.FINISHING,
      shift: 'DAY',
      machineLine: 'Finishing Line 1',
      goodQuantity: 190,
      rejectedQuantity: 8,
      notes: 'ஆட்கள் பற்றாக்குறை - தீபாவளி விடுமுறை கழித்து ஆட்கள் குறைவாக உள்ளனர்',
      clientEventAt: new Date('2026-11-01T17:30:00Z'),
      receivedAt: new Date('2026-11-01T17:32:00Z'),
      approvalStatus: ApprovalStatus.CONFIRMED,
      confirmedBy: merchandiser.name,
      confirmedAt: new Date('2026-11-01T18:00:00Z'),
    },
  });

  const o1Update3 = await prisma.productionUpdate.create({
    data: {
      idempotencyKey: 'idemp_b88240_20261102_003',
      orderId: order1.id,
      milestoneId: o1Milestones[Stage.FINISHING].id,
      supervisorId: supervisorMuthu.id,
      stage: Stage.FINISHING,
      shift: 'DAY',
      machineLine: 'Finishing Line 1',
      goodQuantity: 200,
      rejectedQuantity: 10,
      notes: 'ஊசி உடைஞ்சு போச்சு - காலர் அயர்னிங் டேபிள் மெதுவாக நடக்கிறது',
      clientEventAt: new Date('2026-11-02T16:00:00Z'),
      receivedAt: new Date('2026-11-02T16:01:00Z'),
      approvalStatus: ApprovalStatus.PENDING_REVIEW,
    },
  });

  // Attach photo to Update 3
  await prisma.productionPhoto.create({
    data: {
      productionUpdateId: o1Update3.id,
      s3Url: 'https://s3.ap-south-1.amazonaws.com/threadflow-evidence/b88240_collar_inspection.webp',
      stage: Stage.FINISHING,
      approvalStatus: ApprovalStatus.PENDING_REVIEW,
      isBuyerVisible: false,
    },
  });

  // AI Issue Classification for Update 3
  await prisma.issueClassification.create({
    data: {
      productionUpdateId: o1Update3.id,
      category: IssueCategory.MACHINE_BREAKDOWN,
      confidenceScore: 0.94,
      needsReview: false,
      isConfirmed: false,
      rawTamilText: 'ஊசி உடைஞ்சு போச்சு - காலர் அயர்னிங் டேபிள் மெதுவாக நடக்கிறது',
      translatedText: 'Needle break - collar ironing table operating slower than required run rate',
      classifiedBy: 'AI_GEMINI',
    },
  });

  // Risk Warning for Order 1: 🔴 RED, 5 days late, ₹3.5L air freight
  await prisma.riskWarning.create({
    data: {
      orderId: order1.id,
      milestoneId: o1Milestones[Stage.FINISHING].id,
      riskLevel: RiskLevel.RED,
      requiredDailyRate: 311.1,
      actualRollingRate: 200.0,
      varianceQtyPerDay: -111.1,
      projectedCompletionDate: new Date('2026-11-17T18:00:00Z'),
      daysLate: 5,
      financialExposureRupees: 350000.0,
      mathBreakdown: JSON.stringify({
        remainingQty: 2800,
        workingDaysLeft: 9,
        sundayExclusions: ['2026-11-08'],
        downstreamBufferDays: 0,
        effectiveWorkingDays: 9,
        requiredDailyRate: 311.1,
        actualRollingRate: 200.0,
        wmaCalculation: '(200 * 0.50) + (190 * 0.30) + (220 * 0.20) = 200 pcs/day',
        dailyVariance: -111.1,
        workingDaysNeeded: 14,
        projectedCompletionDate: '2026-11-17',
        daysLate: 5,
        financialDiagnosis: 'Air freight escalation to London Heathrow @ ₹3,50,000 extra cost',
      }),
      mitigationPlan: 'Authorized 2 hours daily overtime across lines and split 500 pcs lot to auxiliary finishing press',
      approvalStatus: ApprovalStatus.PENDING_REVIEW,
      isBuyerVisible: false,
    },
  });

  // ==========================================
  // 6. SEED ORDER 2: C-PO-0488 (🟡 AMBER - Subcontract Buffer Warning)
  // ==========================================
  console.log('[Seed] Step 6: Seeding Order 2 (C-PO-0488 - 🟡 AMBER)...');
  const order2 = await prisma.order.create({
    data: {
      poNumber: 'C-PO-0488',
      buyerId: buyerC.id,
      unitId: printTex.id,
      style: 'Kids Printed Tee Yellow',
      description: 'Single Jersey 160 GSM with water-based rotary chest placement print',
      totalQuantity: 10000,
      fobPricePerPiece: 210.0,
      totalOrderValue: 2100000.0,
      exFactoryDate: new Date('2026-11-28T18:00:00Z'),
      orderDate: new Date('2026-10-10T08:00:00Z'),
      status: 'ACTIVE',
    },
  });

  await prisma.orderLine.create({
    data: { orderId: order2.id, size: '2-3Y', color: 'Canary Yellow', plannedQty: 2500, completedQty: 775 },
  });
  await prisma.orderLine.create({
    data: { orderId: order2.id, size: '4-5Y', color: 'Canary Yellow', plannedQty: 3500, completedQty: 1085 },
  });
  await prisma.orderLine.create({
    data: { orderId: order2.id, size: '6-7Y', color: 'Canary Yellow', plannedQty: 2500, completedQty: 775 },
  });
  await prisma.orderLine.create({
    data: { orderId: order2.id, size: '8-9Y', color: 'Canary Yellow', plannedQty: 1500, completedQty: 465 },
  });

  const o2Milestones = await createTnaMilestones(
    order2.id,
    10000,
    new Date('2026-10-10T08:00:00Z'),
    new Date('2026-11-28T18:00:00Z'),
    Stage.PRINTING,
    3100,
    printTex.id
  );

  // 3 Daily Logs for Order 2: Oct 31 (450 pcs), Nov 1 (460 pcs), Nov 2 (440 pcs) -> Rolling Rate = 450 pcs/day
  // Downstream buffer = 11 days (Cutting 2d + Stitching 6d + Finishing 3d).
  // Total working days left: 23. Effective working days = 23 - 11 = 12 days.
  // Remaining: 6900 pcs. Required rate = 6900 / 12 = 575 pcs/day.
  // Status = AMBER (early 2-week warning before starvation hits stitching/finishing).
  const o2Update3 = await prisma.productionUpdate.create({
    data: {
      idempotencyKey: 'idemp_c0488_20261102_003',
      orderId: order2.id,
      milestoneId: o2Milestones[Stage.PRINTING].id,
      supervisorId: supervisorMuthu.id,
      stage: Stage.PRINTING,
      shift: 'DAY',
      machineLine: 'PrintTex Table 3',
      goodQuantity: 440,
      rejectedQuantity: 15,
      notes: 'பிரிண்டிங் ஸ்கிரீன் சாயம் மிக்ஸிங் லேட் ஆனது',
      clientEventAt: new Date('2026-11-02T15:30:00Z'),
      receivedAt: new Date('2026-11-02T15:32:00Z'),
      approvalStatus: ApprovalStatus.CONFIRMED,
      confirmedBy: merchandiser.name,
      confirmedAt: new Date('2026-11-02T16:10:00Z'),
    },
  });

  // Subcontract Gate Pass for PrintTex
  await prisma.subcontractGatePass.create({
    data: {
      gatePassNumber: 'GP-PRINTTEX-2026-0488',
      orderId: order2.id,
      milestoneId: o2Milestones[Stage.PRINTING].id,
      unitId: printTex.id,
      dispatchedQty: 10000,
      receivedQty: 3100,
      dispatchedAt: new Date('2026-10-24T09:00:00Z'),
      expectedReturnAt: new Date('2026-11-06T18:00:00Z'),
      status: GatePassStatus.PARTIAL_RECEIVED,
      challanDocUrl: 'https://s3.ap-south-1.amazonaws.com/threadflow-evidence/gp_0488_signed.pdf',
      notes: 'Lot 1 (3100 pcs) received and passed inspection. Lot 2 in progress.',
    },
  });

  // Photo
  await prisma.productionPhoto.create({
    data: {
      productionUpdateId: o2Update3.id,
      s3Url: 'https://s3.ap-south-1.amazonaws.com/threadflow-evidence/c0488_print_strikeoff.webp',
      stage: Stage.PRINTING,
      approvalStatus: ApprovalStatus.CONFIRMED,
      isBuyerVisible: true,
    },
  });

  // Risk Warning: 🟡 AMBER, ₹1.05L penalty risk
  await prisma.riskWarning.create({
    data: {
      orderId: order2.id,
      milestoneId: o2Milestones[Stage.PRINTING].id,
      riskLevel: RiskLevel.AMBER,
      requiredDailyRate: 575.0,
      actualRollingRate: 450.0,
      varianceQtyPerDay: -125.0,
      projectedCompletionDate: new Date('2026-12-02T18:00:00Z'),
      daysLate: 4,
      financialExposureRupees: 105000.0,
      mathBreakdown: JSON.stringify({
        remainingQty: 6900,
        totalWorkingDaysLeft: 23,
        downstreamBufferDays: 11,
        effectiveWorkingDays: 12,
        requiredDailyRate: 575.0,
        actualRollingRate: 450.0,
        dailyVariance: -125.0,
        diagnosis: '2-week early buffer warning allows reallocating stitching capacity before finishing is starved. Penalty risk 5%: ₹1,05,000.',
      }),
      mitigationPlan: 'PrintTex assigned second rotary table starting tomorrow 08:00 AM to deliver +200 pcs/day',
      approvalStatus: ApprovalStatus.CONFIRMED,
      isBuyerVisible: false,
    },
  });

  // ==========================================
  // 7. SEED ORDER 3: B-PO-88213 (🟢 GREEN - On Schedule)
  // ==========================================
  console.log('[Seed] Step 7: Seeding Order 3 (B-PO-88213 - 🟢 GREEN)...');
  const order3 = await prisma.order.create({
    data: {
      poNumber: 'B-PO-88213',
      buyerId: buyerB.id,
      unitId: unit2.id,
      style: "Men's Crew Neck Tee Navy",
      description: '100% Combed Cotton 180 GSM Bio-washed with self-fabric neck tape',
      totalQuantity: 12000,
      fobPricePerPiece: 280.0,
      totalOrderValue: 3360000.0,
      exFactoryDate: new Date('2026-11-20T18:00:00Z'),
      orderDate: new Date('2026-10-05T08:00:00Z'),
      status: 'ACTIVE',
    },
  });

  await prisma.orderLine.create({
    data: { orderId: order3.id, size: 'S', color: 'Navy Blue', plannedQty: 2400, completedQty: 1360 },
  });
  await prisma.orderLine.create({
    data: { orderId: order3.id, size: 'M', color: 'Navy Blue', plannedQty: 4800, completedQty: 2720 },
  });
  await prisma.orderLine.create({
    data: { orderId: order3.id, size: 'L', color: 'Navy Blue', plannedQty: 3600, completedQty: 2040 },
  });
  await prisma.orderLine.create({
    data: { orderId: order3.id, size: 'XL', color: 'Navy Blue', plannedQty: 1200, completedQty: 680 },
  });

  const o3Milestones = await createTnaMilestones(
    order3.id,
    12000,
    new Date('2026-10-05T08:00:00Z'),
    new Date('2026-11-20T18:00:00Z'),
    Stage.STITCHING,
    6800,
    unit2.id
  );

  // 3 Daily Logs for Order 3: Oct 31 (430 pcs), Nov 1 (410 pcs), Nov 2 (420 pcs) -> Rolling Rate = 420 pcs/day
  // Downstream buffer = 3 days (Finishing). Total working days = 16. Effective days = 16 - 3 = 13 days.
  // Remaining: 5200 pcs. Required rate = 5200 / 13 = 400 pcs/day.
  // Rolling WMA = 420 pcs/day. Surplus = +20 pcs/day. Safety margin = +2 days ahead.
  const o3Update = await prisma.productionUpdate.create({
    data: {
      idempotencyKey: 'idemp_b88213_20261102_001',
      orderId: order3.id,
      milestoneId: o3Milestones[Stage.STITCHING].id,
      supervisorId: supervisorSelvam.id,
      stage: Stage.STITCHING,
      shift: 'DAY',
      machineLine: 'Unit 2 Line 4',
      goodQuantity: 420,
      rejectedQuantity: 5,
      notes: 'Line running smooth. Operator attendance 100%',
      clientEventAt: new Date('2026-11-02T16:30:00Z'),
      receivedAt: new Date('2026-11-02T16:31:00Z'),
      approvalStatus: ApprovalStatus.CONFIRMED,
      confirmedBy: merchandiser.name,
      confirmedAt: new Date('2026-11-02T17:00:00Z'),
    },
  });

  await prisma.productionPhoto.create({
    data: {
      productionUpdateId: o3Update.id,
      s3Url: 'https://s3.ap-south-1.amazonaws.com/threadflow-evidence/b88213_inline_seam.webp',
      stage: Stage.STITCHING,
      approvalStatus: ApprovalStatus.CONFIRMED,
      isBuyerVisible: true,
    },
  });

  await prisma.riskWarning.create({
    data: {
      orderId: order3.id,
      milestoneId: o3Milestones[Stage.STITCHING].id,
      riskLevel: RiskLevel.GREEN,
      requiredDailyRate: 400.0,
      actualRollingRate: 420.0,
      varianceQtyPerDay: 20.0,
      projectedCompletionDate: new Date('2026-11-18T18:00:00Z'),
      daysLate: 0,
      financialExposureRupees: 0.0,
      mathBreakdown: JSON.stringify({
        remainingQty: 5200,
        totalWorkingDaysLeft: 16,
        downstreamBufferDays: 3,
        effectiveWorkingDays: 13,
        requiredDailyRate: 400.0,
        actualRollingRate: 420.0,
        dailyVariance: 20.0,
        projectedCompletionDate: '2026-11-18',
        safetyMarginDays: 2,
        status: 'On track with +2 days safety buffer ahead of Ex-Factory date',
      }),
      approvalStatus: ApprovalStatus.CONFIRMED,
      isBuyerVisible: true,
    },
  });

  // ==========================================
  // 8. SEED 5 ADDITIONAL ACTIVE ORDERS FOR DIVERSITY
  // ==========================================
  console.log('[Seed] Step 8: Seeding 5 additional orders for realistic filtering...');

  // Additional 1: B-PO-88255 (Cutting, Unit 3 - 🟢 GREEN)
  const addOrder1 = await prisma.order.create({
    data: {
      poNumber: 'B-PO-88255',
      buyerId: buyerB.id,
      unitId: unit3.id,
      style: 'Brushed Fleece Hoodie',
      description: '320 GSM 3-thread fleece with kangaroo pocket and double lined hood',
      totalQuantity: 5000,
      fobPricePerPiece: 520.0,
      totalOrderValue: 2600000.0,
      exFactoryDate: new Date('2026-12-05T18:00:00Z'),
      orderDate: new Date('2026-10-15T08:00:00Z'),
      status: 'ACTIVE',
    },
  });
  await createTnaMilestones(addOrder1.id, 5000, new Date('2026-10-15'), new Date('2026-12-05'), Stage.CUTTING, 1200, unit3.id);

  // Additional 2: C-PO-0492 (Dyeing, WashTex - 🟡 AMBER, Subcontract Overdue)
  const addOrder2 = await prisma.order.create({
    data: {
      poNumber: 'C-PO-0492',
      buyerId: buyerC.id,
      unitId: washTex.id,
      style: 'Organic Rib Tank',
      description: '2x2 Rib 200 GSM with reactive pigment dye wash',
      totalQuantity: 6000,
      fobPricePerPiece: 190.0,
      totalOrderValue: 1140000.0,
      exFactoryDate: new Date('2026-11-22T18:00:00Z'),
      orderDate: new Date('2026-10-08T08:00:00Z'),
      status: 'ACTIVE',
    },
  });
  const add2Milestones = await createTnaMilestones(addOrder2.id, 6000, new Date('2026-10-08'), new Date('2026-11-22'), Stage.DYEING_WASHING, 1500, washTex.id);
  // Add gate pass with delay
  await prisma.subcontractGatePass.create({
    data: {
      gatePassNumber: 'GP-WASHTEX-2026-0492',
      orderId: addOrder2.id,
      milestoneId: add2Milestones[Stage.DYEING_WASHING].id,
      unitId: washTex.id,
      dispatchedQty: 6000,
      receivedQty: 1500,
      dispatchedAt: new Date('2026-10-22T08:00:00Z'),
      expectedReturnAt: new Date('2026-10-31T18:00:00Z'), // Past due!
      status: GatePassStatus.OVERDUE,
      notes: 'Subcontractor batch delayed 52 hours. Effluent treatment plant maintenance in progress.',
    },
  });

  // Additional 3: B-PO-88260 (Knitting, Unit 1 - 🟢 GREEN, High Volume)
  const addOrder3 = await prisma.order.create({
    data: {
      poNumber: 'B-PO-88260',
      buyerId: buyerB.id,
      unitId: unit1.id,
      style: 'Mercerized Cotton Tee',
      description: 'Single Jersey 60s 2-ply mercerized yarn high-luster t-shirt',
      totalQuantity: 15000,
      fobPricePerPiece: 340.0,
      totalOrderValue: 5100000.0,
      exFactoryDate: new Date('2026-12-18T18:00:00Z'),
      orderDate: new Date('2026-10-20T08:00:00Z'),
      status: 'ACTIVE',
    },
  });
  await createTnaMilestones(addOrder3.id, 15000, new Date('2026-10-20'), new Date('2026-12-18'), Stage.KNITTING, 3800, unit1.id);

  // Additional 4: C-PO-0501 (Checking, Unit 2 - 🔴 RED, Bottleneck in 6 days)
  const addOrder4 = await prisma.order.create({
    data: {
      poNumber: 'C-PO-0501',
      buyerId: buyerC.id,
      unitId: unit2.id,
      style: 'Striped Interlock Polo',
      description: 'Yarn-dyed feeder stripe interlock 240 GSM with rib cuff',
      totalQuantity: 7500,
      fobPricePerPiece: 380.0,
      totalOrderValue: 2850000.0,
      exFactoryDate: new Date('2026-11-09T18:00:00Z'), // 6 working days left!
      orderDate: new Date('2026-09-25T08:00:00Z'),
      status: 'ACTIVE',
    },
  });
  const add4Milestones = await createTnaMilestones(addOrder4.id, 7500, new Date('2026-09-25'), new Date('2026-11-09'), Stage.CHECKING, 6100, unit2.id);
  await prisma.riskWarning.create({
    data: {
      orderId: addOrder4.id,
      milestoneId: add4Milestones[Stage.CHECKING].id,
      riskLevel: RiskLevel.RED,
      requiredDailyRate: 233.3,
      actualRollingRate: 120.0,
      varianceQtyPerDay: -113.3,
      projectedCompletionDate: new Date('2026-11-14T18:00:00Z'),
      daysLate: 4,
      financialExposureRupees: 142500.0, // 5% late discount
      mathBreakdown: JSON.stringify({
        remainingQty: 1400,
        workingDaysLeft: 6,
        requiredDailyRate: 233.3,
        actualRollingRate: 120.0,
        daysLate: 4,
        financialDiagnosis: 'Ex-factory in 6 days. Finishing line bottleneck identified.',
      }),
      approvalStatus: ApprovalStatus.PENDING_REVIEW,
      isBuyerVisible: false,
    },
  });

  // Additional 5: B-PO-88272 (Finishing, Unit 3 - 🟢 GREEN, Packing final container)
  const addOrder5 = await prisma.order.create({
    data: {
      poNumber: 'B-PO-88272',
      buyerId: buyerB.id,
      unitId: unit3.id,
      style: 'Waffle Knit Henley',
      description: 'Thermal waffle knit 260 GSM with contrast canvas placket',
      totalQuantity: 4200,
      fobPricePerPiece: 410.0,
      totalOrderValue: 1722000.0,
      exFactoryDate: new Date('2026-11-06T18:00:00Z'),
      orderDate: new Date('2026-09-20T08:00:00Z'),
      status: 'ACTIVE',
    },
  });
  await createTnaMilestones(addOrder5.id, 4200, new Date('2026-09-20'), new Date('2026-11-06'), Stage.FINISHING, 3600, unit3.id);

  // ==========================================
  // 9. AUDIT EVENT LOG ENTRY (Proof of Audit Trail)
  // ==========================================
  await prisma.auditEvent.create({
    data: {
      entityType: 'Order',
      entityId: order1.id,
      action: 'CALIBRATED_SEED_INITIALIZATION',
      category: AuditCategory.DATE_CHANGE,
      reasonCode: 'BASELINE_DEMO_CALIBRATION',
      notes: 'Initial production baseline seeded for Autumn 2026 ship window',
      financialImpactRupees: 350000.0,
      userId: merchandiser.id,
      userRole: Role.MERCHANDISER,
      orderId: order1.id,
    },
  });

  console.log('[Seed] Calibrated Seed Completed Successfully!');
  console.log('--- Summary of Active Orders Seeded ---');
  console.table([
    { PO: 'B-PO-88240', Buyer: 'Company B (UK)', Qty: 8000, Stage: 'Finishing', Status: '🔴 RED (-111 pcs/d, ₹3.5L Air)' },
    { PO: 'C-PO-0488', Buyer: 'Company C (DE)', Qty: 10000, Stage: 'Printing', Status: '🟡 AMBER (11d buffer, ₹1.05L Pen)' },
    { PO: 'B-PO-88213', Buyer: 'Company B (UK)', Qty: 12000, Stage: 'Stitching', Status: '🟢 GREEN (+20 pcs/d, +2d safety)' },
    { PO: 'B-PO-88255', Buyer: 'Company B (UK)', Qty: 5000, Stage: 'Cutting', Status: '🟢 GREEN (On schedule)' },
    { PO: 'C-PO-0492', Buyer: 'Company C (DE)', Qty: 6000, Stage: 'Dyeing', Status: '🟡 AMBER (Subcontract +52h late)' },
    { PO: 'B-PO-88260', Buyer: 'Company B (UK)', Qty: 15000, Stage: 'Knitting', Status: '🟢 GREEN (High volume 980 pcs/d)' },
    { PO: 'C-PO-0501', Buyer: 'Company C (DE)', Qty: 7500, Stage: 'Checking', Status: '🔴 RED (6 days left, bottleneck)' },
    { PO: 'B-PO-88272', Buyer: 'Company B (UK)', Qty: 4200, Stage: 'Finishing', Status: '🟢 GREEN (Container packing)' },
  ]);
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
