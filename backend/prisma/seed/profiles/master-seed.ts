import { PrismaClient, Unit, Buyer, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import masterData from '../fixtures/master-data.json';
import { BuyerFixture, UnitFixture, UserFixture } from '../types';

export interface SeededMasterEntities {
  buyersByCode: Map<string, Buyer>;
  unitsByCode: Map<string, Unit>;
  usersByEmail: Map<string, User>;
}

export class MasterSeedRunner {
  static async run(prisma: PrismaClient, verbose = false): Promise<SeededMasterEntities> {
    if (verbose) console.log('[MasterSeed] Upserting Buyers, Units, Users, Magic Links, and Weekly Reports...');

    const buyersByCode = new Map<string, Buyer>();
    const unitsByCode = new Map<string, Unit>();
    const usersByEmail = new Map<string, User>();

    // 1. Seed Buyers
    for (const b of masterData.buyers as BuyerFixture[]) {
      const buyer = await prisma.buyer.upsert({
        where: { code: b.code },
        update: {
          name: b.name,
          country: b.country,
          contactEmail: b.contactEmail,
        },
        create: {
          name: b.name,
          code: b.code,
          country: b.country,
          contactEmail: b.contactEmail,
        },
      });
      buyersByCode.set(b.code, buyer);
    }

    // 2. Seed Units
    for (const u of masterData.units as UnitFixture[]) {
      const unit = await prisma.unit.upsert({
        where: { code: u.code },
        update: {
          name: u.name,
          type: u.type,
          location: u.location,
        },
        create: {
          name: u.name,
          code: u.code,
          type: u.type,
          location: u.location,
        },
      });
      unitsByCode.set(u.code, unit);
    }

    // 3. Seed Users
    const passwordHash = await bcrypt.hash('ThreadFlow@2026', 10);
    for (const u of masterData.users as UserFixture[]) {
      const assignedUnit = u.assignedUnitCode ? unitsByCode.get(u.assignedUnitCode) : undefined;
      const buyer = u.buyerCode ? buyersByCode.get(u.buyerCode) : undefined;

      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          role: u.role,
          languagePreference: u.languagePreference,
          phone: u.phone,
          assignedUnitId: assignedUnit?.id,
          buyerId: buyer?.id,
          passwordHash,
        },
        create: {
          email: u.email,
          name: u.name,
          passwordHash,
          role: u.role,
          languagePreference: u.languagePreference,
          phone: u.phone,
          assignedUnitId: assignedUnit?.id,
          buyerId: buyer?.id,
        },
      });
      usersByEmail.set(u.email, user);
    }

    // 4. Seed Buyer Magic Links (Non-expired for live Buyer Portal preview)
    const magicExpiry = new Date();
    magicExpiry.setDate(magicExpiry.getDate() + 90);

    for (const [code, buyer] of buyersByCode.entries()) {
      const token = `magic-${code.toLowerCase().replace(/_/g, '-')}-preview`;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await prisma.buyerMagicLink.upsert({
        where: { token },
        update: {
          tokenHash,
          expiresAt: magicExpiry,
          isActive: true,
        },
        create: {
          buyerId: buyer.id,
          token,
          tokenHash,
          expiresAt: magicExpiry,
          isActive: true,
        },
      });
    }

    // 5. Seed Historical Weekly Buyer Reports (Weeks 41 to 45 of 2026)
    const adminUser = usersByEmail.get('admin@threadflow.com') || usersByEmail.get('merchandiser@threadflow.com');
    for (const [code, buyer] of buyersByCode.entries()) {
      const weeks = [41, 42, 43, 44, 45];
      for (const w of weeks) {
        const plannedBase = 22000 + w * 1200;
        const compBase = Math.round(plannedBase * (0.91 + (w % 3) * 0.03));
        const summary = {
          buyerCode: code,
          buyerName: buyer.name,
          weekNumber: w,
          year: 2026,
          reportPeriod: `2026-W${w}`,
          onTimeDeliveryPercentage: 92.4 + (w % 4),
          totalCommittedQty: plannedBase,
          totalProducedQty: compBase,
          activeOrdersTracked: 4 + (w % 3),
          stageThroughput: {
            KNITTING: Math.round(compBase * 1.05),
            DYEING_WASHING: Math.round(compBase * 1.02),
            PRINTING: Math.round(compBase * 0.98),
            CUTTING: compBase,
            STITCHING: Math.round(compBase * 0.95),
            CHECKING: Math.round(compBase * 0.93),
            FINISHING: Math.round(compBase * 0.91),
          },
          riskCount: {
            GREEN: 4,
            AMBER: w >= 44 ? 2 : 1,
            RED: w >= 43 ? 1 : 0,
          },
        };

        const existingReport = await prisma.weeklyBuyerReport.findFirst({
          where: {
            buyerId: buyer.id,
            weekNumber: w,
            year: 2026,
          },
        });

        if (!existingReport) {
          await prisma.weeklyBuyerReport.create({
            data: {
              buyerId: buyer.id,
              weekNumber: w,
              year: 2026,
              fileFormat: 'PDF',
              reportUrl: `https://assets.threadflow.app/reports/weekly-2026-w${w}-${code.toLowerCase()}.pdf`,
              summarySnapshot: JSON.stringify(summary),
              orderCount: summary.activeOrdersTracked,
              generatedById: adminUser?.id,
            },
          });
        }
      }
    }

    if (verbose) {
      console.log(`[MasterSeed] Ready: ${buyersByCode.size} Buyers, ${unitsByCode.size} Units, ${usersByEmail.size} Users.`);
    }

    return { buyersByCode, unitsByCode, usersByEmail };
  }
}
