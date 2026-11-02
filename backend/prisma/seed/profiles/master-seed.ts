import { PrismaClient, Unit, Buyer, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import masterData from '../fixtures/master-data.json';
import { BuyerFixture, UnitFixture, UserFixture } from '../types';

export interface SeededMasterEntities {
  buyersByCode: Map<string, Buyer>;
  unitsByCode: Map<string, Unit>;
  usersByEmail: Map<string, User>;
}

export class MasterSeedRunner {
  static async run(prisma: PrismaClient, verbose = false): Promise<SeededMasterEntities> {
    if (verbose) console.log('[MasterSeed] Idempotently upserting Buyers, Units, and Users...');

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

    if (verbose) {
      console.log(`[MasterSeed] Ready: ${buyersByCode.size} Buyers, ${unitsByCode.size} Units, ${usersByEmail.size} Users.`);
    }

    return { buyersByCode, unitsByCode, usersByEmail };
  }
}
