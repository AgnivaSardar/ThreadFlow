import bcrypt from 'bcryptjs';
import { PrismaClient, Role, UnitType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding ThreadFlow authenticated entities into database threadflow_db (user: dbuser)...');

  // 1. Seed Buyers
  const buyerB = await prisma.buyer.upsert({
    where: { code: 'COMPANY_B' },
    update: {},
    create: {
      name: 'Company B (UK Retailers)',
      code: 'COMPANY_B',
      country: 'United Kingdom',
      contactEmail: 'buyer@company-b.co.uk',
    },
  });

  const buyerC = await prisma.buyer.upsert({
    where: { code: 'COMPANY_C' },
    update: {},
    create: {
      name: 'Company C (Germany Fashion AG)',
      code: 'COMPANY_C',
      country: 'Germany',
      contactEmail: 'compliance@company-c.de',
    },
  });

  console.log('[Seed] Buyers created:', { buyerB: buyerB.code, buyerC: buyerC.code });

  // 2. Seed Units
  const unit1 = await prisma.unit.upsert({
    where: { code: 'UNIT_1' },
    update: {},
    create: {
      name: 'Tiruppur Unit 1 (Knitting & Finishing)',
      code: 'UNIT_1',
      type: UnitType.OWN_UNIT,
      location: 'Avinashi Road, Tiruppur',
    },
  });

  const unit2 = await prisma.unit.upsert({
    where: { code: 'UNIT_2' },
    update: {},
    create: {
      name: 'Tiruppur Unit 2 (Stitching Lines)',
      code: 'UNIT_2',
      type: UnitType.OWN_UNIT,
      location: 'Palladam Road, Tiruppur',
    },
  });

  const printTex = await prisma.unit.upsert({
    where: { code: 'PRINTTEX' },
    update: {},
    create: {
      name: 'PrintTex Subcontractors',
      code: 'PRINTTEX',
      type: UnitType.SUBCONTRACTOR,
      location: 'Angeripalayam, Tiruppur',
    },
  });

  console.log('[Seed] Units created:', { unit1: unit1.code, unit2: unit2.code, printTex: printTex.code });

  // 3. Seed Users with default secure password 'ThreadFlow@2026'
  const passwordHash = await bcrypt.hash('ThreadFlow@2026', 10);

  // Authenticated Persona 1: Merchandiser
  const merchandiser = await prisma.user.upsert({
    where: { email: 'merchandiser@company-a.com' },
    update: { passwordHash },
    create: {
      name: 'Ramesh Merchandiser',
      email: 'merchandiser@company-a.com',
      passwordHash,
      role: Role.MERCHANDISER,
      languagePreference: 'en',
      phone: '+91 98422 10001',
    },
  });

  // Authenticated Persona 2: Floor Supervisor Muthu (Unit 1)
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor.muthu@company-a.com' },
    update: { passwordHash, assignedUnitId: unit1.id },
    create: {
      name: 'Muthu Floor Supervisor',
      email: 'supervisor.muthu@company-a.com',
      passwordHash,
      role: Role.SUPERVISOR,
      languagePreference: 'ta',
      phone: '+91 98422 20002',
      assignedUnitId: unit1.id,
    },
  });

  // Authenticated Persona 3: Foreign Buyer B (UK)
  const buyerUserB = await prisma.user.upsert({
    where: { email: 'buyer@company-b.co.uk' },
    update: { passwordHash, buyerId: buyerB.id },
    create: {
      name: 'Sarah Jenkins (UK Sourcing)',
      email: 'buyer@company-b.co.uk',
      passwordHash,
      role: Role.BUYER,
      buyerId: buyerB.id,
      languagePreference: 'en',
    },
  });

  // Authenticated Persona 4: Foreign Buyer C (Germany)
  const buyerUserC = await prisma.user.upsert({
    where: { email: 'compliance@company-c.de' },
    update: { passwordHash, buyerId: buyerC.id },
    create: {
      name: 'Klaus Mueller (EU Compliance)',
      email: 'compliance@company-c.de',
      passwordHash,
      role: Role.BUYER,
      buyerId: buyerC.id,
      languagePreference: 'en',
    },
  });

  console.log('[Seed] Authenticated Demo Users seeded successfully:');
  console.table([
    { Role: merchandiser.role, Email: merchandiser.email, Name: merchandiser.name },
    { Role: supervisor.role, Email: supervisor.email, Name: supervisor.name },
    { Role: buyerUserB.role, Email: buyerUserB.email, Name: buyerUserB.name },
    { Role: buyerUserC.role, Email: buyerUserC.email, Name: buyerUserC.name },
  ]);

  console.log('[Seed] All open/magic links removed. All access is strictly authenticated via credentials.');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
