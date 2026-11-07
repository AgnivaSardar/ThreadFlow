import { prisma } from '../src/config/db';
import { ProductionService } from '../src/modules/production/production.service';
import { RiskService } from '../src/modules/risk/risk.service';
import { Role, Stage, IssueCategory } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/types/express';
import { getSystemToday } from '../src/common/utils/dates';
import { randomUUID } from 'crypto';

/**
 * Realistic Tiruppur Knitwear Shop-Floor Shift Notes
 */
const REALISTIC_NOTES = [
  'Regular day shift output. All sewing lines operating at 94% efficiency.',
  'Day shift output on schedule. Stitch tension and needle alignment calibrated.',
  'Full team attendance. Production rate on track with daily milestone quota.',
  'Minor thread breakage resolved within 15 minutes. Smooth hourly run-rate.',
  'Fabric lot inspected and cleared by internal QC. Color shading verified.',
  'Line velocity steady. Garment bundles dispatched to checking station.',
  'Normal operations across all lines. Quality parameters within AQL 1.5 standard.',
  'Zero electrical or mechanical stoppages. Daily production target met.',
  'Smooth flow across sizing batches. Defect and rejection rate below 1.2%.',
  'Finishing and iron press lines fully staffed. Barcode scan pass rate 100%.',
];

interface SimulationOptions {
  days: number;
  runAllUntilComplete: boolean;
  targetPoNumber?: string;
  startDate?: Date;
}

function parseCliArgs(): SimulationOptions {
  const args = process.argv.slice(2);
  let days = 1;
  let runAllUntilComplete = false;
  let targetPoNumber: string | undefined;
  let startDate: Date | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all' || arg === '-a') {
      runAllUntilComplete = true;
    } else if (arg === '--days' || arg === '-d') {
      const parsed = parseInt(args[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        days = parsed;
        i++;
      }
    } else if (arg === '--po' || arg === '-p') {
      targetPoNumber = args[i + 1]?.trim();
      i++;
    } else if (arg === '--date') {
      const parsedDate = new Date(args[i + 1]);
      if (!isNaN(parsedDate.getTime())) {
        startDate = parsedDate;
        i++;
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return { days, runAllUntilComplete, targetPoNumber, startDate };
}

function printHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║            ThreadFlow - Daily Production Simulation Engine                ║
╚═══════════════════════════════════════════════════════════════════════════╝

Usage:
  npx tsx scripts/simulate-daily-production.ts [options]
  npm run simulate:daily
  npm run simulate:complete

Options:
  --all, -a            Simulate day-by-day until all active POs reach 100% completion
  --days <N>, -d <N>   Number of consecutive days to simulate (default: 1)
  --po <PO_NUMBER>     Simulate shift updates strictly for a specific PO (e.g. B-PO-88260)
  --date <YYYY-MM-DD>  Base calendar date for the simulation (defaults to system date)
  --help, -h           Show this help message

Examples:
  npm run simulate:daily                 # Simulates 1 day of floor output for all active POs
  npm run simulate:daily -- --days 5     # Simulates next 5 working days
  npm run simulate:complete              # Simulates day-by-day until all 12 active POs finish
  npm run simulate:daily -- --po B-PO-88240  # Simulates 1 day for B-PO-88240 only
`);
}

/**
 * Generates a sane random production quantity for a given milestone.
 * Real Tiruppur apparel lines average 280–520 pieces per shift.
 */
function generateSaneShiftQuantities(remainingQty: number, targetQty: number) {
  // If close to completion, finish the rest
  if (remainingQty <= 480) {
    const good = remainingQty;
    const rej = Math.min(Math.floor(Math.random() * 4) + 1, Math.max(1, Math.round(good * 0.02)));
    return { goodQuantity: good, rejectedQuantity: rej };
  }

  // Sane floor output: between 300 and 520 pcs
  const minDaily = Math.min(300, remainingQty);
  const maxDaily = Math.min(520, remainingQty);
  const good = Math.floor(Math.random() * (maxDaily - minDaily + 1)) + minDaily;

  // Realistic rejection count: 1 to 6 pieces (~1-2% defect rate)
  const rej = Math.min(Math.floor(Math.random() * 6) + 1, Math.max(1, Math.round(good * 0.02)));

  return { goodQuantity: good, rejectedQuantity: rej };
}

/**
 * Allocates good and rejected pieces proportionally across size breakdown lines
 * with zero rounding mismatch.
 */
function allocateSizeBreakdown(
  orderLines: Array<{ id: string; plannedQty: number }>,
  goodQuantity: number,
  rejectedQuantity: number
) {
  const totalPlanned = orderLines.reduce((acc, l) => acc + l.plannedQty, 0);
  let allocatedGood = 0;
  let allocatedRej = 0;

  return orderLines.map((line, idx) => {
    const isLast = idx === orderLines.length - 1;
    const good = isLast
      ? Math.max(0, goodQuantity - allocatedGood)
      : Math.round((line.plannedQty / totalPlanned) * goodQuantity);
    allocatedGood += good;

    const rej = isLast
      ? Math.max(0, rejectedQuantity - allocatedRej)
      : Math.round((line.plannedQty / totalPlanned) * rejectedQuantity);
    allocatedRej += rej;

    return {
      orderLineId: line.id,
      goodQuantity: good,
      rejectedQuantity: rej,
    };
  });
}

async function simulateOneDay(currentSimDate: Date, targetPoNumber?: string) {
  const formattedDate = currentSimDate.toISOString().split('T')[0];
  console.log(`\n========================================================================`);
  console.log(`📅  SIMULATING PRODUCTION FOR DATE: ${formattedDate} (Day Shift)`);
  console.log(`========================================================================`);

  // 1. Fetch Admin fallback
  const adminUser = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (!adminUser) {
    throw new Error('No ADMIN user found in database for simulation fallback.');
  }

  // 2. Query active orders
  const activeOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      ...(targetPoNumber ? { poNumber: targetPoNumber } : {}),
    },
    include: {
      milestones: { orderBy: { sequenceOrder: 'asc' } },
      orderLines: { orderBy: { size: 'asc' } },
      unit: {
        include: {
          users: { where: { role: Role.SUPERVISOR } },
        },
      },
      buyer: true,
    },
    orderBy: { exFactoryDate: 'asc' },
  });

  if (activeOrders.length === 0) {
    console.log(`   ℹ️ No active orders found to simulate.`);
    return { processedCount: 0, completedOrdersCount: 0, allCompleted: true };
  }

  console.log(`   Found ${activeOrders.length} active PO(s) on the shop floor.\n`);

  let processedCount = 0;
  let newlyCompletedOrders = 0;

  for (const order of activeOrders) {
    // Locate the first milestone that has not met its target quantity
    const activeMilestone = order.milestones.find((m) => m.completedQuantity < m.targetQuantity);

    if (!activeMilestone) {
      // Order is already fully finished
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' },
      });
      newlyCompletedOrders++;
      continue;
    }

    const remainingQty = activeMilestone.targetQuantity - activeMilestone.completedQuantity;
    if (remainingQty <= 0) {
      continue;
    }

    // Determine quantities
    const { goodQuantity, rejectedQuantity } = generateSaneShiftQuantities(
      remainingQty,
      activeMilestone.targetQuantity
    );

    // Distribute among sizes
    const sizeBreakdownLines = allocateSizeBreakdown(
      order.orderLines,
      goodQuantity,
      rejectedQuantity
    );

    // Pick authentic supervisor for unit
    const unitSupervisor = order.unit?.users?.[0];
    const authUser: AuthenticatedUser = unitSupervisor
      ? {
          id: unitSupervisor.id,
          email: unitSupervisor.email,
          role: Role.SUPERVISOR,
          assignedUnitId: order.unitId,
          buyerId: null,
          languagePreference: unitSupervisor.languagePreference as any || 'ta',
        }
      : {
          id: adminUser.id,
          email: adminUser.email,
          role: Role.ADMIN,
          assignedUnitId: null,
          buyerId: null,
          languagePreference: 'en',
        };

    const randomNote = REALISTIC_NOTES[Math.floor(Math.random() * REALISTIC_NOTES.length)];
    const shiftTimestamp = new Date(currentSimDate);
    shiftTimestamp.setHours(17, 30, 0, 0); // End of standard day shift

    try {
      const result = await ProductionService.createProductionUpdate(
        {
          idempotencyKey: randomUUID(),
          orderId: order.id,
          milestoneId: activeMilestone.id,
          stage: activeMilestone.stage,
          shift: 'DAY',
          machineLine: `LINE-${((order.milestones.indexOf(activeMilestone) % 4) + 1)}`,
          goodQuantity,
          rejectedQuantity,
          notes: randomNote,
          clientEventAt: shiftTimestamp.toISOString(),
          sizeBreakdownLines,
        },
        authUser
      );

      const updatedMilestone = result.milestone || (result as any).updatedMilestone;
      const newCumulative = updatedMilestone?.completedQuantity ?? (activeMilestone.completedQuantity + goodQuantity);
      const targetQty = activeMilestone.targetQuantity;
      const pct = Math.min(100, Math.round((newCumulative / targetQty) * 100));

      const isStageDone = newCumulative >= targetQty;
      const supervisorName = unitSupervisor?.name || 'Operations Admin';

      console.log(
        `   📦 [${order.poNumber}] ${order.style.padEnd(28)} | Stage: ${activeMilestone.stage.padEnd(16)} | ` +
        `+${String(goodQuantity).padStart(4)} pcs (${String(newCumulative).padStart(5)} / ${targetQty.toLocaleString()} pcs -> ${pct}%) ` +
        `| Supervisor: ${supervisorName}`
      );

      if (isStageDone) {
        const nextMilestone = order.milestones.find((m) => m.sequenceOrder === activeMilestone.sequenceOrder + 1);
        if (nextMilestone) {
          console.log(`      ✨ Stage [${activeMilestone.stage}] reached 100%! Ready to progress to [${nextMilestone.stage}].`);
        } else {
          console.log(`      🎉 Final Stage [FINISHING] completed! Order #${order.poNumber} is now 100% COMPLETE!`);
          newlyCompletedOrders++;
        }
      }

      processedCount++;
    } catch (err: any) {
      console.error(`   ❌ Failed to record update for ${order.poNumber} (${activeMilestone.stage}):`, err.message);
    }
  }

  // Check remaining active orders in database
  const checkOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      ...(targetPoNumber ? { poNumber: targetPoNumber } : {}),
    },
    include: {
      milestones: true,
    },
  });

  const remainingActiveCount = checkOrders.filter((o) =>
    o.milestones.some((m) => m.completedQuantity < m.targetQuantity)
  ).length;

  console.log(`\n   📊 Day Summary: ${processedCount} shift update(s) recorded. Active orders remaining: ${remainingActiveCount}.`);

  return {
    processedCount,
    completedOrdersCount: newlyCompletedOrders,
    allCompleted: remainingActiveCount === 0,
  };
}

async function main() {
  const options = parseCliArgs();

  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║             ThreadFlow Manufacturing Shift Simulation Engine              ║
╚═══════════════════════════════════════════════════════════════════════════╝`);

  const baseDate = options.startDate || getSystemToday();
  const currentSimDate = new Date(baseDate);

  if (options.runAllUntilComplete) {
    console.log(`🚀 Mode: Continuous Day-by-Day Simulation until ALL POs complete.`);
    console.log(`📍 Starting Date: ${currentSimDate.toISOString().split('T')[0]}`);
    if (options.targetPoNumber) {
      console.log(`🎯 Targeted PO: ${options.targetPoNumber}`);
    }

    let dayCounter = 1;
    const MAX_DAYS = 90; // Circuit breaker to prevent infinite loops

    while (dayCounter <= MAX_DAYS) {
      const res = await simulateOneDay(currentSimDate, options.targetPoNumber);
      if (res.allCompleted) {
        console.log(`\n🏁 SUCCESS: All active purchase orders have reached 100% completion in ${dayCounter} simulated day(s)!`);
        break;
      }

      // Advance to next day
      currentSimDate.setDate(currentSimDate.getDate() + 1);
      dayCounter++;

      // Brief pause to allow background async risk/audit hooks to settle
      await new Promise((r) => setTimeout(r, 120));
    }

    if (dayCounter > MAX_DAYS) {
      console.warn(`\n⚠️ Circuit breaker triggered: Simulation reached maximum ${MAX_DAYS} days.`);
    }
  } else {
    console.log(`🚀 Mode: Simulating ${options.days} Day(s) of Factory Output.`);
    console.log(`📍 Starting Date: ${currentSimDate.toISOString().split('T')[0]}`);
    if (options.targetPoNumber) {
      console.log(`🎯 Targeted PO: ${options.targetPoNumber}`);
    }

    for (let d = 1; d <= options.days; d++) {
      console.log(`\n--- Day ${d} of ${options.days} ---`);
      const res = await simulateOneDay(currentSimDate, options.targetPoNumber);
      if (res.allCompleted) {
        console.log(`\n🎉 All targeted purchase orders reached 100% completion!`);
        break;
      }
      currentSimDate.setDate(currentSimDate.getDate() + 1);
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  // Trigger an active risk board recalculation pass so all Formula 1 & 2 cards reflect fresh numbers
  console.log(`\n🔄 Updating factory-wide risk assessments and 3-day run-rate metrics...`);
  const activeOrdersForRisk = await prisma.order.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    include: { milestones: true },
  });

  const adminAuth: AuthenticatedUser = {
    id: 'system-sim',
    email: 'admin@threadflow.com',
    role: Role.ADMIN,
    assignedUnitId: null,
    buyerId: null,
    languagePreference: 'en',
  };

  await Promise.allSettled(
    activeOrdersForRisk.map(async (ord) => {
      const activeM = ord.milestones.find((m) => m.completedQuantity < m.targetQuantity) || ord.milestones[ord.milestones.length - 1];
      if (activeM) {
        await RiskService.evaluateOrderMilestoneRisk(ord.id, activeM.id, adminAuth);
      }
    })
  );

  console.log(`✅ Simulation complete! Run-rate metrics, milestone pipelines, and audit logs are fully updated.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Fatal simulation error:', err);
  process.exit(1);
});
