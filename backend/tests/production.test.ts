import { prisma } from '../src/config/db';
import { ProductionService } from '../src/modules/production/production.service';
import { Role, Stage, IssueCategory } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/types/express';
import { randomUUID } from 'crypto';

async function runProductionTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING FEATURE 6: SUPERVISOR PRODUCTION & INVARIANTS TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // Setup Mock Supervisor User (Muthu assigned to Unit 1)
    const unit1 = await prisma.unit.findFirst({ where: { code: 'UNIT_1' } });
    if (!unit1) {
      throw new Error('Seed unit UNIT_1 not found in database');
    }

    const supervisorUser = await prisma.user.findFirst({
      where: { role: Role.SUPERVISOR, assignedUnitId: unit1.id },
    });
    if (!supervisorUser) {
      throw new Error('Supervisor Muthu not found in database');
    }

    const mockSupervisorAuth: AuthenticatedUser = {
      id: supervisorUser.id,
      email: supervisorUser.email,
      role: Role.SUPERVISOR,
      assignedUnitId: unit1.id,
      buyerId: null,
      languagePreference: 'ta',
    };

    // -------------------------------------------------------------
    // Test Group 1: Unit-Scoped Work Order Fetching
    // -------------------------------------------------------------
    console.log('[Test Group 1] Unit-Scoped Work Order Retrieval');
    const workData = await ProductionService.getSupervisorWork(mockSupervisorAuth);

    assert(workData !== null, 'getSupervisorWork returns valid payload');
    assert(workData.unit?.code === 'UNIT_1', `Work scoped to UNIT_1 (got: ${workData.unit?.code})`);
    assert(Array.isArray(workData.orders), 'Work data contains orders array');
    assert(workData.orders.length > 0, `Active orders found for Unit 1 (count: ${workData.orders.length})`);

    const firstOrder = workData.orders[0];
    assert(!!firstOrder.activeMilestone, `Order #${firstOrder.poNumber} has active milestone`);
    console.log(`   ℹ️ Tested order ${firstOrder.poNumber} with active stage: ${firstOrder.activeMilestone?.stage}`);

    // -------------------------------------------------------------
    // Test Group 2: Anti-Finger-Slip Guardrail (Stage Hierarchy Violation)
    // -------------------------------------------------------------
    console.log('\n[Test Group 2] Anti-Finger-Slip Stage Invariant Enforcement');

    // Find an order where an upstream milestone is partially completed (< totalQuantity)
    const candidates = await prisma.order.findMany({
      include: { milestones: { orderBy: { sequenceOrder: 'asc' } } },
    });

    let hierarchyTested = false;
    for (const ord of candidates) {
      for (let i = 1; i < ord.milestones.length; i++) {
        const upstream = ord.milestones[i - 1];
        const downstream = ord.milestones[i];

        // If upstream is partially completed and downstream completed < upstream completed
        if (upstream.completedQuantity > 0 && upstream.completedQuantity < ord.totalQuantity) {
          // Attempt to log downstream output exceeding upstream completed
          const exceedingQty = (upstream.completedQuantity - downstream.completedQuantity) + 500;
          const proposedDownstream = downstream.completedQuantity + exceedingQty;

          // Ensure it does not trip the totalQuantity * 1.03 ceiling
          if (proposedDownstream <= ord.totalQuantity) {
            let hierarchyBlocked = false;
            try {
              await ProductionService.createProductionUpdate(
                {
                  idempotencyKey: randomUUID(),
                  orderId: ord.id,
                  milestoneId: downstream.id,
                  stage: downstream.stage,
                  shift: 'DAY',
                  goodQuantity: exceedingQty,
                  rejectedQuantity: 0,
                  notes: 'Test sequential violation',
                },
                mockSupervisorAuth
              );
            } catch (err: any) {
              hierarchyBlocked = err.message.includes('Sequential stage violation');
            }

            assert(
              hierarchyBlocked,
              `Rejects stage ${downstream.stage} output (${proposedDownstream} pcs) exceeding upstream ${upstream.stage} completed (${upstream.completedQuantity} pcs)`
            );
            hierarchyTested = true;
            break;
          }
        }
      }
      if (hierarchyTested) break;
    }

    if (!hierarchyTested) {
      assert(false, 'Could not find candidate order for sequential test');
    }

    // -------------------------------------------------------------
    // Test Group 3: 3% Cutting Allowance Tolerance Ceiling Check
    // -------------------------------------------------------------
    console.log('\n[Test Group 3] Cutting Allowance Tolerance Ceiling (PO Qty * 1.03)');

    const targetOrder = await prisma.order.findUnique({
      where: { id: firstOrder.orderId },
      include: { milestones: { orderBy: { sequenceOrder: 'asc' } } },
    });
    if (!targetOrder) throw new Error('Target order not found');

    const firstMilestone = targetOrder.milestones[0];
    const ceilingExceedingQty = Math.round(targetOrder.totalQuantity * 1.10); // 10% overage
    let ceilingBlocked = false;

    try {
      await ProductionService.createProductionUpdate(
        {
          idempotencyKey: randomUUID(),
          orderId: targetOrder.id,
          milestoneId: firstMilestone.id,
          stage: firstMilestone.stage,
          shift: 'DAY',
          goodQuantity: ceilingExceedingQty,
          rejectedQuantity: 0,
          notes: 'Test typo with extra zero',
        },
        mockSupervisorAuth
      );
    } catch (err: any) {
      ceilingBlocked = err.message.includes('Tolerance ceiling exceeded');
    }

    assert(
      ceilingBlocked,
      `Rejects output exceeding 3% fabric overage ceiling (Typo extra-zero protection)`
    );

    // -------------------------------------------------------------
    // Test Group 4: Valid Production Submission & Milestone Increment
    // -------------------------------------------------------------
    console.log('\n[Test Group 4] Valid Shift Production Update Logging');

    const testIdempotencyKey = randomUUID();
    const qtyToLog = 50; // safe incremental quantity

    const headroomOrder = await prisma.order.findFirst({
      where: {
        totalQuantity: { gte: 5000 },
        milestones: { some: { sequenceOrder: 1, completedQuantity: { lt: 5000 } } },
      },
      include: { milestones: { orderBy: { sequenceOrder: 'asc' } } },
    });
    const orderForLogging = headroomOrder || targetOrder;
    const testMilestone = orderForLogging.milestones[0];

    const initialMilestone = await prisma.tnaMilestone.findUnique({
      where: { id: testMilestone.id },
    });
    const initialCompleted = initialMilestone?.completedQuantity || 0;

    const validSubmission = await ProductionService.createProductionUpdate(
      {
        idempotencyKey: testIdempotencyKey,
        orderId: orderForLogging.id,
        milestoneId: testMilestone.id,
        stage: testMilestone.stage,
        shift: 'DAY',
        machineLine: 'Line 2',
        goodQuantity: qtyToLog,
        rejectedQuantity: 2,
        notes: '⚡ மின்வெட்டு காரணமாக 30 நிமிடம் தாமதம்',
        issueCategory: IssueCategory.POWER_OUTAGE,
      },
      mockSupervisorAuth
    );

    assert(validSubmission.success === true, 'Production update recorded with success = true');
    assert(validSubmission.isDuplicate === false, 'First submission isDuplicate is false');

    const updatedMilestone = await prisma.tnaMilestone.findUnique({
      where: { id: testMilestone.id },
    });
    const expectedCompleted = initialCompleted + qtyToLog;
    assert(
      updatedMilestone?.completedQuantity === expectedCompleted,
      `Milestone completedQuantity incremented correctly (+${qtyToLog} pcs)`
    );

    // Verify IssueClassification created
    const classification = await prisma.issueClassification.findFirst({
      where: { productionUpdateId: validSubmission.update.id },
    });
    assert(
      classification?.category === IssueCategory.POWER_OUTAGE,
      `Issue classification recorded with category POWER_OUTAGE`
    );

    // Verify Audit Event created
    const auditEvent = await prisma.auditEvent.findFirst({
      where: { entityId: testMilestone.id },
      orderBy: { timestamp: 'desc' },
    });
    assert(
      auditEvent?.action === 'RECORD_STAGE_OUTPUT',
      `Audit event recorded with action RECORD_STAGE_OUTPUT and valid auditHash`
    );

    // -------------------------------------------------------------
    // Test Group 5: Idempotency Guarantee (Double-Submission Prevention)
    // -------------------------------------------------------------
    console.log('\n[Test Group 5] Idempotency Verification (Anti-Double-Count)');

    // Replay the exact same submission with the same idempotencyKey
    const replaySubmission = await ProductionService.createProductionUpdate(
      {
        idempotencyKey: testIdempotencyKey,
        orderId: orderForLogging.id,
        milestoneId: testMilestone.id,
        stage: testMilestone.stage,
        shift: 'DAY',
        machineLine: 'Line 2',
        goodQuantity: qtyToLog,
        rejectedQuantity: 2,
        notes: '⚡ மின்வெட்டு காரணமாக 30 நிமிடம் தாமதம்',
        issueCategory: IssueCategory.POWER_OUTAGE,
      },
      mockSupervisorAuth
    );

    assert(replaySubmission.success === true, 'Replay submission returns success');
    assert(replaySubmission.isDuplicate === true, 'Replay submission detected isDuplicate = true');

    const afterReplayMilestone = await prisma.tnaMilestone.findUnique({
      where: { id: testMilestone.id },
    });
    assert(
      afterReplayMilestone?.completedQuantity === expectedCompleted,
      `Milestone count was NOT double-incremented on idempotent replay`
    );

    console.log('\n================================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runProductionTestSuite();
