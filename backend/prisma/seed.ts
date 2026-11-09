import { PrismaClient } from '@prisma/client';
import { SeedCliOptions, SeedProfile, CalibratedOrderFixture } from './seed/types';
import { SeedSafetyGuard } from './seed/safety-guard';
import { MasterSeedRunner } from './seed/profiles/master-seed';
import { OrdersSeedRunner } from './seed/profiles/orders-seed';
import { StressGenerator } from './seed/generators/stress-generator';
import calibratedOrdersFixture from './seed/fixtures/calibrated-orders.json';
import minimalOrdersFixture from './seed/fixtures/minimal-orders.json';
import { getSystemToday } from '../src/common/utils/dates';

const prisma = new PrismaClient();

// Authoritative system anchor dynamically resolved to current operating date
const ANCHOR_DATE = getSystemToday();

function parseArgs(): SeedCliOptions {
  const args = process.argv.slice(2);
  let profile: SeedProfile = 'calibrated';
  let clean = false;
  let forceDestructiveWipe = false;
  let confirmationKey: string | undefined;
  let stressCount = 30;
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith('--profile=')) {
      const val = arg.split('=')[1] as SeedProfile;
      if (['calibrated', 'stress', 'minimal', 'master-only'].includes(val)) {
        profile = val;
      } else {
        console.warn(`[SeedCLI] Unknown profile "${val}", defaulting to "calibrated".`);
      }
    } else if (arg === '--clean' || arg === '-c') {
      clean = true;
    } else if (arg === '--force-destructive-wipe') {
      forceDestructiveWipe = true;
    } else if (arg.startsWith('--confirmation-key=')) {
      confirmationKey = arg.split('=')[1];
    } else if (arg.startsWith('--stress-count=')) {
      stressCount = parseInt(arg.split('=')[1], 10) || 30;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    }
  }

  return {
    profile,
    clean,
    forceDestructiveWipe,
    confirmationKey,
    stressCount,
    verbose,
  };
}

async function safeCleanDatabase(verbose = false) {
  if (verbose) console.log('[Seed] Executing cascading purge of previous records...');
  await prisma.$transaction([
    prisma.productionUpdateLine.deleteMany(),
    prisma.productionPhoto.deleteMany(),
    prisma.issueClassification.deleteMany(),
    prisma.riskMitigationAction.deleteMany(),
    prisma.subcontractGatePass.deleteMany(),
    prisma.weeklyBuyerReport.deleteMany(),
    prisma.auditEvent.deleteMany(),
    prisma.riskWarning.deleteMany(),
    prisma.productionUpdate.deleteMany(),
    prisma.tnaMilestone.deleteMany(),
    prisma.orderLine.deleteMany(),
    prisma.order.deleteMany(),
    prisma.buyerMagicLink.deleteMany(),
    prisma.user.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.buyer.deleteMany(),
  ]);
  if (verbose) console.log('[Seed] Purge completed.');
}

async function main() {
  const startTime = Date.now();
  const options = parseArgs();

  console.log('================================================================================');
  console.log(`🏭 THREADFLOW SEED ENGINE (Simulated Anchor: ${ANCHOR_DATE.toISOString().split('T')[0]})`);
  console.log(`Profile: ${options.profile.toUpperCase()} | Idempotent Upsert: ${options.clean ? 'CLEAN & REBUILD' : 'NON-DESTRUCTIVE'}`);
  console.log('================================================================================');

  // 1. Safety Guardrail Execution
  SeedSafetyGuard.assertSafeToExecute(options);

  // 2. Optional Clean Purge
  if (options.clean) {
    await safeCleanDatabase(options.verbose);
  }

  // 3. Upsert Master Entities (Buyers, Units, Users)
  console.log('[Seed] Upserting Master Infrastructure (Buyers, Units, Accounts)...');
  const master = await MasterSeedRunner.run(prisma, options.verbose);

  // 4. Dispatch Order Fixtures Based on Profile
  let ordersToSeed: CalibratedOrderFixture[] = [];
  if (options.profile === 'calibrated') {
    ordersToSeed = calibratedOrdersFixture as unknown as CalibratedOrderFixture[];
  } else if (options.profile === 'minimal') {
    ordersToSeed = minimalOrdersFixture as unknown as CalibratedOrderFixture[];
  } else if (options.profile === 'stress') {
    console.log(`[Seed] Synthesizing ${options.stressCount} orders with multi-shift floor logs for stress profile...`);
    ordersToSeed = StressGenerator.generateStressOrders(options.stressCount, ANCHOR_DATE);
  } else if (options.profile === 'master-only') {
    ordersToSeed = [];
  }

  // 5. Upsert Orders & Floor Telemetry
  let stats = { ordersSeeded: 0, logsSeeded: 0, warningsSeeded: 0 };
  if (ordersToSeed.length > 0) {
    console.log(`[Seed] Processing ${ordersToSeed.length} orders and manufacturing telemetry...`);
    stats = await OrdersSeedRunner.run(prisma, ordersToSeed, master, ANCHOR_DATE, options.verbose);
  }

  // 6. Record Audit Event for Seed Run
  const systemMerchandiser = master.usersByEmail.get('merchandiser@threadflow.com');
  if (systemMerchandiser) {
    await prisma.auditEvent.create({
      data: {
        entityType: 'System',
        entityId: 'seed-engine',
        userId: systemMerchandiser.id,
        userRole: 'MERCHANDISER',
        category: 'RISK_STATUS_CHANGE',
        action: `SEED_RUN_${options.profile.toUpperCase()}`,
        reasonCode: 'SYSTEM_CALIBRATION_SEED',
        notes: JSON.stringify({
          profile: options.profile,
          clean: options.clean,
          ordersSeeded: stats.ordersSeeded,
          logsSeeded: stats.logsSeeded,
          warningsSeeded: stats.warningsSeeded,
          durationMs: Date.now() - startTime,
        }),
      },
    });
  }

  // 7. Verify and Print Summary Metrics
  const [
    totalBuyers,
    totalUnits,
    totalUsers,
    totalOrders,
    totalMilestones,
    totalOrderLines,
    totalLogs,
    totalUpdateLines,
    totalPhotos,
    totalClassifications,
    totalRiskWarnings,
    totalMitigations,
    totalGatePasses,
    totalMagicLinks,
    totalReports,
    totalAuditEvents,
  ] = await Promise.all([
    prisma.buyer.count(),
    prisma.unit.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.tnaMilestone.count(),
    prisma.orderLine.count(),
    prisma.productionUpdate.count(),
    prisma.productionUpdateLine.count(),
    prisma.productionPhoto.count(),
    prisma.issueClassification.count(),
    prisma.riskWarning.count(),
    prisma.riskMitigationAction.count(),
    prisma.subcontractGatePass.count(),
    prisma.buyerMagicLink.count(),
    prisma.weeklyBuyerReport.count(),
    prisma.auditEvent.count(),
  ]);

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n✅ [Seed] Database Seeding Completed Successfully in ' + elapsedSec + 's!');
  console.log('--------------------------------------------------------------------------------');
  console.table([
    { Entity: 'Buyers', InDB: totalBuyers },
    { Entity: 'Manufacturing Units', InDB: totalUnits },
    { Entity: 'Users & Roles', InDB: totalUsers },
    { Entity: 'Orders', InDB: totalOrders },
    { Entity: 'TNA Milestones (1-7)', InDB: totalMilestones },
    { Entity: 'Order Lines (Color/Size)', InDB: totalOrderLines },
    { Entity: 'Floor Production Logs', InDB: totalLogs },
    { Entity: 'Size Breakdown Lines', InDB: totalUpdateLines },
    { Entity: 'Photo Evidences', InDB: totalPhotos },
    { Entity: 'AI Issue Classifications', InDB: totalClassifications },
    { Entity: 'Risk Warnings (Red/Amber/Grn)', InDB: totalRiskWarnings },
    { Entity: 'Risk Mitigation Actions', InDB: totalMitigations },
    { Entity: 'Subcontract Gate Passes', InDB: totalGatePasses },
    { Entity: 'Buyer Magic Links', InDB: totalMagicLinks },
    { Entity: 'Weekly Buyer Reports', InDB: totalReports },
    { Entity: 'Tamper-Evident Audit Events', InDB: totalAuditEvents },
  ]);
  console.log('--------------------------------------------------------------------------------');
}

main()
  .catch((err) => {
    console.error('\n❌ [Seed] Fatal Seed Failure:');
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
