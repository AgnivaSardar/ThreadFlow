import { prisma } from '../src/config/db';
import { OrdersService, subtractWorkingDays, computeMilestoneDates } from '../src/modules/orders/orders.service';
import { createOrderSchema, updateExFactoryDateSchema } from '../src/modules/orders/orders.schema';
import { AuthenticatedUser } from '../src/common/types/express';
import { Role, Stage } from '@prisma/client';

async function runOrdersTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING ORDERS & TNA MILESTONE PIPELINE TEST SUITE');
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
    // 1. Test Sunday Exclusion and Buffer Working Days Math
    console.log('[Test Group 1] Sunday-Excluded Working Days & Buffer Math');
    // Anchor: 2026-11-12 is a Thursday.
    // Subtract 1 working day -> Wednesday 2026-11-11
    // Subtract 4 working days:
    // Thursday -> Wed (1), Tue (2), Mon (3), (Skip Sunday 2026-11-08), Sat (4) -> 2026-11-07
    const anchorThurs = new Date('2026-11-12T00:00:00Z');
    const resultSub = subtractWorkingDays(anchorThurs, 4);
    assert(resultSub.toISOString().startsWith('2026-11-07'), 'subtractWorkingDays correctly skips Sundays');

    // 2. Test 7-Stage Milestone Dates Computation
    console.log('\n[Test Group 2] 7-Stage Knitwear Milestone Generation');
    const exFactory = new Date('2026-11-28T00:00:00Z');
    const orderDate = new Date('2026-10-15T00:00:00Z');
    const milestones = computeMilestoneDates(exFactory, orderDate);
    assert(milestones.length === 7, 'Instantiates exactly 7 knitwear milestones');
    assert(milestones[0].stage === Stage.KNITTING && milestones[0].bufferDaysAhead === 18, 'Stage 1 is KNITTING with 18 buffer days');
    assert(milestones[1].stage === Stage.DYEING_WASHING && milestones[1].bufferDaysAhead === 14, 'Stage 2 is DYEING_WASHING with 14 buffer days');
    assert(milestones[2].stage === Stage.PRINTING && milestones[2].bufferDaysAhead === 11, 'Stage 3 is PRINTING with 11 buffer days');
    assert(milestones[3].stage === Stage.CUTTING && milestones[3].bufferDaysAhead === 9, 'Stage 4 is CUTTING with 9 buffer days');
    assert(milestones[4].stage === Stage.STITCHING && milestones[4].bufferDaysAhead === 3, 'Stage 5 is STITCHING with 3 buffer days');
    assert(milestones[5].stage === Stage.CHECKING && milestones[5].bufferDaysAhead === 2, 'Stage 6 is CHECKING with 2 buffer days');
    assert(milestones[6].stage === Stage.FINISHING && milestones[6].bufferDaysAhead === 0, 'Stage 7 is FINISHING with 0 buffer days');

    // 3. Test Zod Validation Invariants
    console.log('\n[Test Group 3] Zod Schema Validation Guardrails');
    const validPayload = {
      body: {
        poNumber: 'TEST-PO-9901',
        buyerId: 'dummy-buyer-id',
        unitId: 'dummy-unit-id',
        style: 'Cotton Crew Tee Navy',
        totalQuantity: 10000,
        exFactoryDate: '2026-12-15T00:00:00Z',
        currency: 'INR',
        exchangeRate: 1.0,
        fobPricePerPiece: 240,
        sizeBreakdowns: [
          { size: 'S', color: 'Navy', plannedQty: 2000 },
          { size: 'M', color: 'Navy', plannedQty: 4000 },
          { size: 'L', color: 'Navy', plannedQty: 3000 },
          { size: 'XL', color: 'Navy', plannedQty: 1000 },
        ],
      },
    };
    const validParsed = await createOrderSchema.safeParseAsync(validPayload);
    assert(validParsed.success, 'Valid order payload passes Zod validation');

    const mismatchedPayload = {
      body: {
        ...validPayload.body,
        totalQuantity: 10000,
        sizeBreakdowns: [
          { size: 'S', color: 'Navy', plannedQty: 2000 },
          { size: 'M', color: 'Navy', plannedQty: 4000 },
          { size: 'L', color: 'Navy', plannedQty: 1000 }, // sum = 7000 != 10000
        ],
      },
    };
    const invalidParsed = await createOrderSchema.safeParseAsync(mismatchedPayload);
    assert(!invalidParsed.success, 'Rejects payload where sum of sizes != totalQuantity');

    const emptyReasonPayload = {
      params: { id: 'order-123' },
      body: {
        newExFactoryDate: '2026-12-20T00:00:00Z',
        reasonCode: '',
      },
    };
    const emptyReasonParsed = await updateExFactoryDateSchema.safeParseAsync(emptyReasonPayload);
    assert(!emptyReasonParsed.success, 'Rejects updateExFactoryDate with empty reasonCode');

    // 4. Test End-to-End Database Transaction (Order Creation, Lines, Milestones, Audit)
    console.log('\n[Test Group 4] Database Transactions & Audit Log Integration');
    const buyer = await prisma.buyer.findFirst();
    const unit = await prisma.unit.findFirst();
    const user = await prisma.user.findFirst({ where: { role: Role.MERCHANDISER } }) || await prisma.user.findFirst();

    if (!buyer || !unit || !user) {
      console.warn('  ⚠️ Skipping DB tests: database not seeded. Please run seed script first.');
    } else {
      const authUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        buyerId: user.buyerId,
        assignedUnitId: user.assignedUnitId,
      };

      const testPoNumber = `T-PO-${Date.now().toString().slice(-6)}`;
      const createdOrder = await OrdersService.createOrder(
        {
          poNumber: testPoNumber,
          buyerId: buyer.id,
          unitId: unit.id,
          style: 'Test Pique Polo Navy',
          totalQuantity: 6000,
          exFactoryDate: '2026-12-24T00:00:00Z',
          currency: 'INR',
          exchangeRate: 1.0,
          fobPricePerPiece: 350,
          sizeBreakdowns: [
            { size: 'S', color: 'Navy', plannedQty: 1000 },
            { size: 'M', color: 'Navy', plannedQty: 2000 },
            { size: 'L', color: 'Navy', plannedQty: 2000 },
            { size: 'XL', color: 'Navy', plannedQty: 1000 },
          ],
        },
        authUser
      );

      assert(createdOrder.poNumber === testPoNumber, 'Order created with correct PO number');
      assert(createdOrder.orderLines.length === 4, 'All 4 child OrderLine sizes created');
      assert(createdOrder.milestones.length === 7, 'Automatically created all 7 TNA milestones');
      assert(createdOrder.auditEvents.length >= 1, 'Initial AuditEvent recorded in database');

      // 5. Test Ex-Factory Date Modification & Audit Chaining
      console.log('\n[Test Group 5] Ex-Factory Date Modification & Audit Chaining');
      const updatedOrder = await OrdersService.updateExFactoryDate(
        createdOrder.id,
        '2026-12-30T00:00:00Z',
        'BUYER_REQUEST',
        user.id,
        'Buyer requested 6-day postponement due to distribution center holiday'
      );

      assert(
        new Date(updatedOrder.exFactoryDate).toISOString().startsWith('2026-12-30'),
        'Ex-Factory date updated to new date'
      );
      assert(updatedOrder.version === 1, 'Optimistic concurrency version incremented');

      // Verify AuditEvent row
      const auditLog = await prisma.auditEvent.findFirst({
        where: {
          entityId: createdOrder.id,
          action: 'UPDATE_EX_FACTORY_DATE',
        },
      });

      assert(!!auditLog, 'Audit log row created for date change');
      assert(auditLog?.reasonCode === 'BUYER_REQUEST', 'Reason code recorded accurately');
      assert(!!auditLog?.auditHash, 'Cryptographic tamper-evident auditHash generated');

      // Clean up test order
      await prisma.auditEvent.deleteMany({ where: { orderId: createdOrder.id } });
      await prisma.tnaMilestone.deleteMany({ where: { orderId: createdOrder.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: createdOrder.id } });
      await prisma.order.delete({ where: { id: createdOrder.id } });
      console.log('\n  🧹 Cleaned up test order fixtures.');

      // 5b. Test Flexible Custom Stage Lead Times & Dates
      console.log('\n[Test Group 5b] Flexible Custom Stage Lead Times & Dates');
      const customPoNumber = `C-PO-${Date.now().toString().slice(-6)}`;
      const customOrder = await OrdersService.createOrder(
        {
          poNumber: customPoNumber,
          buyerId: buyer.id,
          unitId: unit.id,
          style: 'Custom Flexible Stage Order',
          totalQuantity: 2000,
          orderDate: '2026-11-02T00:00:00Z',
          exFactoryDate: '2026-12-15T00:00:00Z',
          currency: 'INR',
          sizeBreakdowns: [{ size: 'M', color: 'Navy', plannedQty: 2000 }],
          customStages: [
            { stage: Stage.KNITTING, sequenceOrder: 1, durationDays: 5, plannedStart: '2026-11-02T00:00:00Z', plannedEnd: '2026-11-07T00:00:00Z' },
            { stage: Stage.DYEING_WASHING, sequenceOrder: 2, durationDays: 4, plannedStart: '2026-11-07T00:00:00Z', plannedEnd: '2026-11-12T00:00:00Z' },
            { stage: Stage.PRINTING, sequenceOrder: 3, durationDays: 2, plannedStart: '2026-11-12T00:00:00Z', plannedEnd: '2026-11-14T00:00:00Z' },
            { stage: Stage.CUTTING, sequenceOrder: 4, durationDays: 3, plannedStart: '2026-11-14T00:00:00Z', plannedEnd: '2026-11-18T00:00:00Z' },
            { stage: Stage.STITCHING, sequenceOrder: 5, durationDays: 7, plannedStart: '2026-11-18T00:00:00Z', plannedEnd: '2026-11-26T00:00:00Z' },
            { stage: Stage.CHECKING, sequenceOrder: 6, durationDays: 2, plannedStart: '2026-11-26T00:00:00Z', plannedEnd: '2026-11-28T00:00:00Z' },
            { stage: Stage.FINISHING, sequenceOrder: 7, durationDays: 3, plannedStart: '2026-11-28T00:00:00Z', plannedEnd: '2026-12-02T00:00:00Z' },
          ],
        },
        authUser
      );

      assert(customOrder.milestones.length === 7, 'Created 7 milestones from custom stage inputs');
      const customKnitting = customOrder.milestones.find((m) => m.stage === Stage.KNITTING);
      assert(
        new Date(customKnitting!.plannedEnd).toISOString().startsWith('2026-11-07'),
        'Custom Knitting plannedEnd respected (2026-11-07)'
      );
      assert(customKnitting!.bufferDaysAhead > 0, 'Custom buffer days ahead computed automatically');

      // Clean up custom order
      await prisma.auditEvent.deleteMany({ where: { orderId: customOrder.id } });
      await prisma.tnaMilestone.deleteMany({ where: { orderId: customOrder.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: customOrder.id } });
      await prisma.order.delete({ where: { id: customOrder.id } });
      console.log('  🧹 Cleaned up custom flexible order fixtures.');

      // 6. Test Order List Filtering and Pagination
      console.log('\n[Test Group 6] Order Listing & Pagination Architecture');
      const listResult = await OrdersService.listOrders({ page: '1', limit: '3' }, authUser);
      assert(Array.isArray(listResult.orders), 'Returns paginated orders array');
      assert(listResult.orders.length <= 3, 'Respects pagination limit parameter');
      assert(listResult.pagination.page === 1, 'Pagination current page is 1');
      assert(listResult.pagination.limit === 3, 'Pagination limit is 3');
      assert(typeof listResult.pagination.total === 'number', 'Reports total orders count');
      assert(typeof listResult.pagination.totalPages === 'number', 'Computes total pages count');

      // 7. Test Bulk Date Shift, Buyer Notification & Critical Path Analysis
      console.log('\n[Test Group 7] Bulk Schedule Postponement & Critical Path Upgrades');
      const sampleOrders = await prisma.order.findMany({ take: 2 });
      if (sampleOrders.length >= 2) {
        const orderIds = sampleOrders.map((o) => o.id);
        const originalDates = sampleOrders.map((o) => o.exFactoryDate);

        const bulkResult = await OrdersService.bulkShiftExFactoryDate(
          orderIds,
          4, // shift forward by 4 working days
          undefined,
          'FABRIC_DELAY',
          user.id,
          'Regional yarn dyeing facility delay due to power cut'
        );

        assert(bulkResult.updatedCount === 2, 'Bulk shifted exactly 2 orders');

        // Verify buyer notification audit log was created
        const notifLog = await prisma.auditEvent.findFirst({
          where: {
            entityId: orderIds[0],
            action: 'BUYER_SCHEDULE_NOTIFICATION',
          },
          orderBy: { timestamp: 'desc' },
        });
        assert(!!notifLog, 'Automated Buyer Notification AuditEvent recorded');
        assert(notifLog?.reasonCode === 'AUTOMATED_DISPATCH', 'Notification marked as AUTOMATED_DISPATCH');

        // Test single order detail with Critical Path & Size Skew directive
        const detail = await OrdersService.getOrderById(orderIds[0], authUser);
        assert(Array.isArray(detail.milestones), 'Returns milestones with buffer tracking');
        assert(Array.isArray(detail.sizeProgress), 'Returns size progress breakdowns');

        // Revert back
        for (let i = 0; i < orderIds.length; i++) {
          await OrdersService.updateExFactoryDate(
            orderIds[i],
            originalDates[i].toISOString(),
            'OTHER',
            user.id,
            'Test suite fixture restoration'
          );
        }
        console.log('  🧹 Reverted sample orders back to original dates.');
      }
    }

    console.log('\n================================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Unhandled test suite failure:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runOrdersTestSuite();
