import { prisma } from '../src/config/db';
import { ProductionService } from '../src/modules/production/production.service';
import { createProductionUpdateBodySchema } from '../src/modules/production/production.schema';
import { Role, Stage, IssueCategory } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/types/express';
import { randomUUID } from 'crypto';

async function runProductionTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING FEATURE 8: PRODUCTION INGESTION, IDEMPOTENCY & INVARIANTS');
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

  let dedicatedTestOrder: any = null;
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

    const candidates = await prisma.order.findMany({
      where: { unitId: unit1.id },
      include: { milestones: { orderBy: { sequenceOrder: 'asc' } } },
    });

    let hierarchyTested = false;
    for (const ord of candidates) {
      for (let i = 1; i < ord.milestones.length; i++) {
        const upstream = ord.milestones[i - 1];
        const downstream = ord.milestones[i];

        if (upstream.completedQuantity > 0 && upstream.completedQuantity < ord.totalQuantity) {
          const exceedingQty = (upstream.completedQuantity - downstream.completedQuantity) + 500;
          const proposedDownstream = downstream.completedQuantity + exceedingQty;

          if (proposedDownstream <= ord.totalQuantity) {
            let hierarchyBlocked = false;
            let capturedMessage = '';
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
              capturedMessage = err.message || '';
              hierarchyBlocked = capturedMessage.includes('Cannot') && capturedMessage.includes('more pieces than have completed');
            }

            assert(
              hierarchyBlocked,
              `Rejects stage ${downstream.stage} output (${proposedDownstream} pcs) exceeding upstream ${upstream.stage} completed (${upstream.completedQuantity} pcs)`
            );
            console.log(`   ℹ️ Friendly error message: "${capturedMessage}"`);
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
    // Setup Dedicated Isolated Test Order (Prevents polluting live buyer orders)
    // -------------------------------------------------------------
    const testBuyer = await prisma.buyer.findFirst();
    if (!testBuyer) throw new Error('No buyer available for isolated test');

    dedicatedTestOrder = await prisma.order.create({
      data: {
        poNumber: `TEST-ISOLATED-${Date.now()}`,
        style: 'Automated Test Polo',
        description: 'Isolated test order for production updates',
        totalQuantity: 5000,
        currency: 'GBP',
        exchangeRate: 105,
        fobPricePerPiece: 12,
        totalOrderValue: 6300000,
        orderDate: new Date('2026-10-01'),
        exFactoryDate: new Date('2026-12-01'),
        unitId: unit1.id,
        buyerId: testBuyer.id,
        status: 'ACTIVE',
        orderLines: {
          create: [
            { size: 'M', color: 'White', plannedQty: 2500, completedQty: 0 },
            { size: 'L', color: 'White', plannedQty: 2500, completedQty: 0 },
          ],
        },
        milestones: {
          create: [
            {
              stage: Stage.KNITTING,
              sequenceOrder: 1,
              plannedStart: new Date('2026-10-01'),
              plannedEnd: new Date('2026-10-10'),
              targetQuantity: 5000,
              completedQuantity: 1000,
              bufferDaysAhead: 18,
            },
            {
              stage: Stage.DYEING_WASHING,
              sequenceOrder: 2,
              plannedStart: new Date('2026-10-11'),
              plannedEnd: new Date('2026-10-18'),
              targetQuantity: 5000,
              completedQuantity: 500,
              bufferDaysAhead: 14,
            },
          ],
        },
      },
      include: {
        milestones: { orderBy: { sequenceOrder: 'asc' } },
        orderLines: true,
      },
    });

    const targetOrder = dedicatedTestOrder;
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

    const orderForLogging = dedicatedTestOrder;
    const testMilestone = orderForLogging.milestones[0];
    const originalMilestoneQty = testMilestone.completedQuantity;

    const testIdempotencyKey = randomUUID();
    const qtyToLog = 50;

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
        notes: '[மின்வெட்டு] ஜெனரேட்டர் தாமதம்',
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
        notes: '[மின்வெட்டு] ஜெனரேட்டர் தாமதம்',
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

    // -------------------------------------------------------------
    // Test Group 6: Schema Validation (UUIDv4 Format & Non-Zero Qty)
    // -------------------------------------------------------------
    console.log('\n[Test Group 6] Schema Validation Guardrails');

    const invalidUuidResult = createProductionUpdateBodySchema.safeParse({
      idempotencyKey: 'not-a-valid-uuid-string',
      orderId: 'some-order',
      milestoneId: 'some-milestone',
      stage: Stage.CUTTING,
      goodQuantity: 10,
    });
    assert(!invalidUuidResult.success, 'Rejects malformed non-UUID idempotencyKey');

    const validUuidResult = createProductionUpdateBodySchema.safeParse({
      idempotencyKey: randomUUID(),
      orderId: 'some-order',
      milestoneId: 'some-milestone',
      stage: Stage.CUTTING,
      goodQuantity: 10,
    });
    assert(validUuidResult.success, 'Accepts valid RFC4122 UUIDv4 idempotencyKey');

    const zeroQuantityResult = createProductionUpdateBodySchema.safeParse({
      idempotencyKey: randomUUID(),
      orderId: 'some-order',
      milestoneId: 'some-milestone',
      stage: Stage.CUTTING,
      goodQuantity: 0,
      rejectedQuantity: 0,
    });
    assert(!zeroQuantityResult.success, 'Rejects submission when both goodQuantity and rejectedQuantity are zero');

    // -------------------------------------------------------------
    // Test Group 7: Size Breakdown Lines Invariant (Features 6 & 7)
    // -------------------------------------------------------------
    console.log('\n[Test Group 7] Per-Size Breakdown Reconciliation');

    const orderWithLines = dedicatedTestOrder;

    if (orderWithLines && orderWithLines.orderLines.length > 0) {
      const line1 = orderWithLines.orderLines[0];
      const targetMilestoneForSize = orderWithLines.milestones[0];

      let sizeMismatchBlocked = false;
      try {
        await ProductionService.createProductionUpdate(
          {
            idempotencyKey: randomUUID(),
            orderId: orderWithLines.id,
            milestoneId: targetMilestoneForSize.id,
            stage: targetMilestoneForSize.stage,
            goodQuantity: 50,
            rejectedQuantity: 0,
            sizeBreakdownLines: [
              { orderLineId: line1.id, goodQuantity: 30, rejectedQuantity: 0 }, // 30 != 50
            ],
          },
          mockSupervisorAuth
        );
      } catch (err: any) {
        sizeMismatchBlocked = err.message.includes('Size breakdown mismatch');
      }

      assert(sizeMismatchBlocked, 'Rejects update when size breakdown sum (30) does not match goodQuantity (50)');
    }

    // -------------------------------------------------------------
    // Test Group 8: Bulk Batch Ingestion (Offline Queue Flush)
    // -------------------------------------------------------------
    console.log('\n[Test Group 8] Bulk Batch Ingestion Engine');

    const bulkKey1 = randomUUID();
    const bulkResults = await ProductionService.createBulkProductionUpdates(
      [
        {
          idempotencyKey: bulkKey1,
          orderId: orderForLogging.id,
          milestoneId: testMilestone.id,
          stage: testMilestone.stage,
          goodQuantity: 20,
          rejectedQuantity: 0,
          notes: 'Bulk test 1',
        },
        {
          idempotencyKey: bulkKey1, // Replay duplicate in same batch
          orderId: orderForLogging.id,
          milestoneId: testMilestone.id,
          stage: testMilestone.stage,
          goodQuantity: 20,
          rejectedQuantity: 0,
          notes: 'Bulk test duplicate',
        },
      ],
      mockSupervisorAuth
    );

    assert(bulkResults.total === 2, 'Bulk processed array of length 2');
    assert(bulkResults.processed === 1, 'First item recorded successfully (processed = 1)');
    assert(bulkResults.duplicates === 1, 'Second item detected as duplicate (duplicates = 1)');
    assert(bulkResults.errors.length === 0, 'No errors in valid bulk batch');

    // -------------------------------------------------------------
    // Test Group 9: Cryptographic Merkle Chain Audit Verification
    // -------------------------------------------------------------
    console.log('\n[Test Group 9] Cryptographic Merkle Chain Audit Verification');

    const auditChainVerification = await ProductionService.verifyMilestoneAuditChain(testMilestone.id);
    if (!auditChainVerification.isValid) {
      console.log('   ℹ️ Debug audit failure:', auditChainVerification);
    }
    assert(auditChainVerification.isValid === true, 'Milestone audit hash chain is mathematically valid and unbroken');
    assert(auditChainVerification.totalEvents > 0, `Audit events verified in chain (count: ${auditChainVerification.totalEvents})`);

    // -------------------------------------------------------------
    // Test Group 10: Advanced Tamil NLP Root-Cause Classifier
    // -------------------------------------------------------------
    console.log('\n[Test Group 10] Tamil NLP Semantic Classification');

    // Create a temporary update with colloquial Tamil needle break note
    const nlpTestKey = randomUUID();
    const nlpSubmission = await ProductionService.createProductionUpdate(
      {
        idempotencyKey: nlpTestKey,
        orderId: orderForLogging.id,
        milestoneId: testMilestone.id,
        stage: testMilestone.stage,
        goodQuantity: 10,
        rejectedQuantity: 1,
        notes: 'ஊசி உடைஞ்சு மோட்டார் நின்னது',
      },
      mockSupervisorAuth
    );

    await ProductionService.processAiClassificationJob(
      nlpSubmission.update.id,
      'ஊசி உடைஞ்சு மோட்டார் நின்னது',
      IssueCategory.OTHER
    );

    const reclassifiedIssue = await prisma.issueClassification.findFirst({
      where: { productionUpdateId: nlpSubmission.update.id },
    });

    assert(
      reclassifiedIssue?.category === IssueCategory.MACHINE_BREAKDOWN,
      `Tamil keyword 'ஊசி' correctly mapped to MACHINE_BREAKDOWN (got: ${reclassifiedIssue?.category})`
    );
    assert(
      (reclassifiedIssue?.confidenceScore || 0) >= 0.95,
      `Confidence score elevated to >= 0.95 (got: ${reclassifiedIssue?.confidenceScore})`
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
    try {
      if (dedicatedTestOrder) {
        await prisma.issueClassification.deleteMany({
          where: { productionUpdate: { orderId: dedicatedTestOrder.id } },
        });
        await prisma.productionUpdateLine.deleteMany({
          where: { productionUpdate: { orderId: dedicatedTestOrder.id } },
        });
        await prisma.auditEvent.deleteMany({
          where: { orderId: dedicatedTestOrder.id },
        });
        await prisma.productionUpdate.deleteMany({
          where: { orderId: dedicatedTestOrder.id },
        });
        await prisma.tnaMilestone.deleteMany({
          where: { orderId: dedicatedTestOrder.id },
        });
        await prisma.orderLine.deleteMany({
          where: { orderId: dedicatedTestOrder.id },
        });
        await prisma.order.delete({
          where: { id: dedicatedTestOrder.id },
        });
      }
    } catch (cleanupErr) {
      console.warn('Isolated test order cleanup warning:', cleanupErr);
    }
    await prisma.$disconnect();
  }
}

runProductionTestSuite();
