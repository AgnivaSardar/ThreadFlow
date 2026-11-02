import { prisma } from '../src/config/db';
import {
  calculateWorkingDaysExcludingSundays,
  addWorkingDaysExcludingSundays,
  calculate3DayWeightedRate,
  evaluateProductionRisk,
  DEFAULT_DOWNSTREAM_BUFFERS,
} from '../src/modules/risk/risk.engine';
import { RiskService } from '../src/modules/risk/risk.service';
import { Stage, RiskLevel, Role } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/types/express';

async function runRiskTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING FEATURE 5: SHOW-YOUR-MATH RUN-RATE ENGINE TEST SUITE');
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
    // 1. Test Sunday Exclusion Day-by-Day Loop
    console.log('[Test Group 1] Calendar Exclusions (Sundays Excluded)');
    // 2026-11-02 is Monday, 2026-11-09 is Monday (7 calendar days, 1 Sunday on Nov 08).
    // Working days: Mon 2, Tue 3, Wed 4, Thu 5, Fri 6, Sat 7 -> 6 working days.
    const startMon = new Date('2026-11-02T00:00:00Z');
    const endMon = new Date('2026-11-09T00:00:00Z');
    const workingDays = calculateWorkingDaysExcludingSundays(startMon, endMon);
    assert(workingDays === 6, `Nov 2 to Nov 9 yields exactly 6 working days (got: ${workingDays})`);

    // Same day returns 0 working days
    assert(calculateWorkingDaysExcludingSundays(startMon, startMon) === 0, 'Same day start and end yields 0 working days');

    // addWorkingDaysExcludingSundays
    // Starting Monday Nov 2, add 6 working days -> should land on Monday Nov 9 (skipping Sunday Nov 8)
    const projectedEnd = addWorkingDaysExcludingSundays(startMon, 6);
    assert(projectedEnd.toISOString().startsWith('2026-11-09'), `Adding 6 working days to Nov 2 reaches Nov 9 (got: ${projectedEnd.toISOString()})`);

    // 2. Test 3-Day Weighted Moving Average (0.50, 0.30, 0.20)
    console.log('\n[Test Group 2] 3-Day Weighted Moving Average (0.50 / 0.30 / 0.20)');
    // Three daily logs: Day 1 (latest) = 800, Day 2 = 700, Day 3 = 600
    // Expected = (800 * 0.50) + (700 * 0.30) + (600 * 0.20) = 400 + 210 + 120 = 730
    const logs3 = [
      { date: '2026-11-02', quantity: 800 },
      { date: '2026-11-01', quantity: 700 },
      { date: '2026-10-31', quantity: 600 },
    ];
    const wma3 = calculate3DayWeightedRate(logs3);
    assert(wma3.rate === 730, `3-Day WMA equals 730 (got: ${wma3.rate})`);

    // Two logs fallback (62.5% Day 1, 37.5% Day 2)
    // 800 * 0.625 + 600 * 0.375 = 500 + 225 = 725
    const logs2 = [
      { date: '2026-11-02', quantity: 800 },
      { date: '2026-11-01', quantity: 600 },
    ];
    const wma2 = calculate3DayWeightedRate(logs2);
    assert(wma2.rate === 725, `2-Day WMA weights properly normalized (got: ${wma2.rate})`);

    // One log fallback
    const logs1 = [{ date: '2026-11-02', quantity: 500 }];
    const wma1 = calculate3DayWeightedRate(logs1);
    assert(wma1.rate === 500, `Single day rate equals 500 (got: ${wma1.rate})`);

    // Empty logs fallback
    const wma0 = calculate3DayWeightedRate([]);
    assert(wma0.rate === 0, `Empty logs rate equals 0 (got: ${wma0.rate})`);

    // 3. Test Downstream Buffer Constants
    console.log('\n[Test Group 3] Downstream Buffer Constants Verification');
    assert(DEFAULT_DOWNSTREAM_BUFFERS[Stage.KNITTING] === 18, 'Knitting buffer is 18d');
    assert(DEFAULT_DOWNSTREAM_BUFFERS[Stage.DYEING_WASHING] === 14, 'Dyeing buffer is 14d');
    assert(DEFAULT_DOWNSTREAM_BUFFERS[Stage.PRINTING] === 11, 'Printing buffer is 11d');
    assert(DEFAULT_DOWNSTREAM_BUFFERS[Stage.CUTTING] === 9, 'Cutting buffer is 9d');
    assert(DEFAULT_DOWNSTREAM_BUFFERS[Stage.STITCHING] === 3, 'Stitching buffer is 3d');
    assert(DEFAULT_DOWNSTREAM_BUFFERS[Stage.CHECKING] === 2, 'Checking buffer is 2d');
    assert(DEFAULT_DOWNSTREAM_BUFFERS[Stage.FINISHING] === 0, 'Finishing buffer is 0d');

    // 4. Test evaluateProductionRisk Calculation and Math Breakdown
    console.log('\n[Test Group 4] Transparent Math Breakdown & Status Assignment');
    // Scenario 1: Deficit case (RED)
    // Remaining = 4,000 pcs, Effective days = 4, Required rate = 1,000 pcs/day
    // Actual rolling rate = 500 pcs/day (Deficit: -500 pcs/day)
    // Days needed = 4,000 / 500 = 8 working days. Planned stage end is Nov 04, so Nov 02 + 8 days lands late.
    const redEvaluation = evaluateProductionRisk({
      orderId: 'test-order-1',
      milestoneId: 'test-m-1',
      targetQuantity: 10000,
      completedQuantity: 6000,
      stage: Stage.CHECKING,
      plannedStageStart: new Date('2026-11-01T00:00:00Z'),
      plannedStageEnd: new Date('2026-11-04T00:00:00Z'),
      exFactoryDate: new Date('2026-11-10T00:00:00Z'),
      simulatedToday: new Date('2026-11-02T10:00:00Z'),
      dailyLogs: [
        { date: '2026-11-02', quantity: 500 },
        { date: '2026-11-01', quantity: 500 },
        { date: '2026-10-31', quantity: 500 },
      ],
      subcontractorTransitHours: 0,
    });

    assert(redEvaluation.riskLevel === RiskLevel.RED, `Evaluates status as RED when projected completion exceeds deadline (got: ${redEvaluation.riskLevel})`);
    assert(redEvaluation.daysLate > 0, `Days late > 0 (got: ${redEvaluation.daysLate})`);
    assert(redEvaluation.financialExposureRupees > 0, `RED has proportional financial exposure (got: ₹${redEvaluation.financialExposureRupees.toLocaleString()})`);
    assert(redEvaluation.varianceQtyPerDay < 0, `Variance is negative (got: ${redEvaluation.varianceQtyPerDay})`);
    assert(redEvaluation.differencePill.includes('Deficit'), `Difference pill shows Deficit text (got: "${redEvaluation.differencePill}")`);
    assert(redEvaluation.mathBreakdown.requiredRateMath.formula.includes('Remaining Pieces'), 'Math breakdown contains Formula 1 description');
    assert(redEvaluation.mathBreakdown.actualRateMath.formula.includes('0.50'), 'Math breakdown contains Formula 2 weights');
    assert(redEvaluation.mathBreakdown.requiredRateMath.substituted.includes('4,000'), 'Substituted Formula 1 contains remaining pieces');

    // Scenario 2: On-track case (GREEN)
    // Remaining = 1,000 pcs, Effective days = 5, Required = 200 pcs/day. Actual rolling = 400 pcs/day (+200 surplus).
    const greenEvaluation = evaluateProductionRisk({
      orderId: 'test-order-2',
      milestoneId: 'test-m-2',
      targetQuantity: 5000,
      completedQuantity: 4000,
      stage: Stage.STITCHING,
      plannedStageStart: new Date('2026-11-01T00:00:00Z'),
      plannedStageEnd: new Date('2026-11-14T00:00:00Z'),
      exFactoryDate: new Date('2026-11-20T00:00:00Z'),
      simulatedToday: new Date('2026-11-02T10:00:00Z'),
      dailyLogs: [
        { date: '2026-11-02', quantity: 400 },
        { date: '2026-11-01', quantity: 400 },
      ],
      subcontractorTransitHours: 0,
    });

    assert(greenEvaluation.riskLevel === RiskLevel.GREEN, 'Evaluates status as GREEN when rate is ahead and buffer >= 2d');
    assert(greenEvaluation.financialExposureRupees === 0, 'GREEN financial exposure is ₹0');
    assert(greenEvaluation.varianceQtyPerDay > 0, 'Variance is positive');
    assert(greenEvaluation.differencePill.includes('On Track'), `Difference pill shows On Track text (got: "${greenEvaluation.differencePill}")`);

    // Scenario 3: Caution case (AMBER) - Subcontractor turnaround > 48h or tight buffer
    const amberEvaluation = evaluateProductionRisk({
      orderId: 'test-order-3',
      milestoneId: 'test-m-3',
      targetQuantity: 6000,
      completedQuantity: 4200,
      stage: Stage.PRINTING,
      plannedStageStart: new Date('2026-10-25T00:00:00Z'),
      plannedStageEnd: new Date('2026-11-15T00:00:00Z'),
      exFactoryDate: new Date('2026-11-28T00:00:00Z'),
      simulatedToday: new Date('2026-11-02T10:00:00Z'),
      dailyLogs: [
        { date: '2026-11-02', quantity: 600 },
        { date: '2026-11-01', quantity: 600 },
      ],
      subcontractorTransitHours: 54, // > 48 hours trigger
    });

    assert(amberEvaluation.riskLevel === RiskLevel.AMBER, 'Evaluates status as AMBER when subcontractor turnaround exceeds 48h');
    assert(amberEvaluation.financialExposureRupees > 0, `AMBER has proportional financial exposure (got: ₹${amberEvaluation.financialExposureRupees.toLocaleString()})`);

    // 5. Test Live "What-If" Capacity Simulation
    console.log('\n[Test Group 5] Live "What-If" Capacity Simulation Engine');
    const simulationResult = RiskService.simulateRateAdjustment(
      4200, // remaining pcs
      800,  // simulated daily rate
      10,   // working days to ship
      2,    // downstream buffer days
      new Date('2026-11-12T00:00:00Z').toISOString()
    );

    assert(typeof simulationResult.workingDaysNeeded === 'number', 'Simulation returns working days needed');
    assert(simulationResult.simulatedRisk in RiskLevel, 'Simulation yields valid RiskLevel');
    assert(typeof simulationResult.financialExposureRupees === 'number', 'Simulation calculates adjusted financial exposure');

    // 6. Test RiskService Database Query & Persistence
    console.log('\n[Test Group 6] RiskService Active Risk Listing');
    const adminUser: AuthenticatedUser = {
      id: 'admin-id',
      email: 'admin@threadflow.test',
      role: Role.ADMIN,
      buyerId: null,
      unitId: null,
    };

    const riskListing = await RiskService.listActiveRisks({}, adminUser);
    assert(Array.isArray(riskListing.risks), 'listActiveRisks returns an array of risks');
    assert(typeof riskListing.summary.totalMonitoredOrders === 'number', 'Summary includes totalMonitoredOrders count');
    assert(typeof riskListing.summary.totalExposureRupees === 'number', 'Summary includes aggregate exposure ₹');

  } catch (err: any) {
    console.error('💥 Unhandled Exception in Risk Test Suite:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`🏁 RISK ENGINE TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRiskTestSuite();
