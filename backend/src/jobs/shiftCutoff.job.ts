import { prisma } from '../config/db';
import { Role } from '@prisma/client';

export interface MissingOrderSummary {
  orderId: string;
  poNumber: string;
  style: string;
  targetQuantity: number;
  activeStage: string;
}

export interface UnitMissingUpdateGroup {
  unitId: string;
  unitName: string;
  unitCode: string;
  unitLocation: string | null;
  supervisorId: string | null;
  supervisorName: string;
  supervisors?: { id: string; name: string; phone: string | null; email: string }[];
  supervisorPhone: string;
  missingOrdersCount: number;
  orders: MissingOrderSummary[];
  whatsappUrl: string;
  bilingualMessage: string;
}

export interface ShiftCutoffEvaluationResult {
  serverTimeIso: string;
  currentTimeIst: string;
  isPastCutoff: boolean;
  cutoffTimeIst: string;
  missingUnitsCount: number;
  missingOrdersCount: number;
  groups: UnitMissingUpdateGroup[];
}

/**
 * Calculates current time in Indian Standard Time (IST / Asia/Kolkata)
 */
export function getIstDateTime(): { nowIst: Date; hoursIst: number; minutesIst: number; dateStrIst: string; startOfDayUtc: Date } {
  const now = new Date();
  
  // Format to IST string components
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = istFormatter.formatToParts(now);
  const findPart = (t: string) => parts.find((p) => p.type === t)?.value || '00';

  const year = parseInt(findPart('year'), 10);
  const month = parseInt(findPart('month'), 10) - 1; // 0-indexed
  const day = parseInt(findPart('day'), 10);
  const hours = parseInt(findPart('hour'), 10);
  const minutes = parseInt(findPart('minute'), 10);

  // Start of day in IST is 00:00:00 IST => which is previous day 18:30:00 UTC
  // Construct date representing 00:00:00 in IST
  const startOfDayIstInUtc = new Date(Date.UTC(year, month, day, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000);

  return {
    nowIst: now,
    hoursIst: hours,
    minutesIst: minutes,
    dateStrIst: `${findPart('year')}-${findPart('month')}-${findPart('day')}`,
    startOfDayUtc: startOfDayIstInUtc,
  };
}

/**
 * Generates bilingual Tamil (top) + English (bottom) text for floor supervisor WhatsApp nudge
 */
export function generateBilingualWhatsAppNudge(
  supervisorName: string,
  unitName: string,
  poNumbers: string[],
  appUrl: string = 'https://threadflow.app/supervisor/my-work'
): { message: string; encodedUrl: string; phone: string } {
  const poListStr = poNumbers.slice(0, 3).join(', ') + (poNumbers.length > 3 ? ` +${poNumbers.length - 3} more` : '');

  const tamilMessage = `வணக்கம் ${supervisorName}, ${unitName}-ல் உள்ள ஆர்டர்கள் (${poListStr}) இன்றைய ஷிப்ட் உற்பத்தி எண்ணிக்கை இன்னும் பதிவு செய்யப்படவில்லை. தயவுசெய்து ThreadFlow Supervisor செயலியில் உடனே பதிவு செய்யவும்.`;
  const englishMessage = `Hello ${supervisorName}, today's shift production update for orders (${poListStr}) at ${unitName} is pending. Please log the floor count in ThreadFlow immediately: ${appUrl}`;

  const combinedMessage = `${tamilMessage}\n\n${englishMessage}`;

  return {
    message: combinedMessage,
    encodedUrl: encodeURIComponent(combinedMessage),
    phone: '',
  };
}

/**
 * Sweeps all active orders and detects which units and supervisors have not logged
 * their required daily production update for today's shift by the 6:00 PM IST cut-off.
 */
export async function detectMissingShiftUpdates(simulateCutoff: boolean = false): Promise<ShiftCutoffEvaluationResult> {
  const { hoursIst, minutesIst, startOfDayUtc, dateStrIst, nowIst } = getIstDateTime();

  // 18:00 IST is the 6:00 PM shift cut-off time
  const isPastCutoff = simulateCutoff || hoursIst >= 18;

  // Query all active orders
  const activeOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
    },
    include: {
      unit: {
        include: {
          users: {
            where: { role: Role.SUPERVISOR },
            select: { id: true, name: true, phone: true, email: true },
          },
        },
      },
      milestones: {
        where: { deletedAt: null },
        orderBy: { sequenceOrder: 'asc' },
      },
      productionUpdates: {
        where: {
          clientEventAt: {
            gte: startOfDayUtc,
          },
        },
        select: { id: true, stage: true, clientEventAt: true },
      },
    },
    orderBy: { exFactoryDate: 'asc' },
  });

  // Filter orders that have 0 updates logged today
  const missingOrders = activeOrders.filter((o) => o.productionUpdates.length === 0);

  // Group by production unit
  const unitMap = new Map<string, UnitMissingUpdateGroup>();

  for (const order of missingOrders) {
    const unit = order.unit;
    if (!unit) continue;

    // Find all supervisors assigned to this unit
    const supervisors = unit.users || [];
    const supervisorNames = supervisors.length > 0
      ? supervisors.map((s) => s.name).join(', ')
      : 'Floor Supervisor';
    const primarySupervisor = supervisors[0] || null;
    // Format telephone (standard 10-digit or E.164 with India country code 91)
    let rawPhone = primarySupervisor?.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    // Determine current active milestone stage
    const activeMilestone =
      order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
      order.milestones[0];

    const orderSummary: MissingOrderSummary = {
      orderId: order.id,
      poNumber: order.poNumber,
      style: order.style,
      targetQuantity: order.totalQuantity,
      activeStage: activeMilestone?.stage || order.milestones[0]?.stage || 'KNITTING',
    };

    if (!unitMap.has(unit.id)) {
      unitMap.set(unit.id, {
        unitId: unit.id,
        unitName: unit.name,
        unitCode: unit.code,
        unitLocation: unit.location,
        supervisorId: primarySupervisor?.id || null,
        supervisorName: supervisorNames,
        supervisors: supervisors.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
        })),
        supervisorPhone: cleanPhone,
        missingOrdersCount: 0,
        orders: [],
        whatsappUrl: '',
        bilingualMessage: '',
      });
    }

    const group = unitMap.get(unit.id)!;
    group.orders.push(orderSummary);
    group.missingOrdersCount = group.orders.length;
  }

  // Generate WhatsApp nudge URLs for each group
  const groups = Array.from(unitMap.values()).map((g) => {
    const poList = g.orders.map((o) => o.poNumber);
    const nudge = generateBilingualWhatsAppNudge(g.supervisorName, g.unitName, poList);
    return {
      ...g,
      bilingualMessage: nudge.message,
      whatsappUrl: `https://wa.me/${g.supervisorPhone}?text=${nudge.encodedUrl}`,
    };
  });

  return {
    serverTimeIso: nowIst.toISOString(),
    currentTimeIst: `${String(hoursIst).padStart(2, '0')}:${String(minutesIst).padStart(2, '0')} IST (${dateStrIst})`,
    isPastCutoff,
    cutoffTimeIst: '18:00 IST',
    missingUnitsCount: groups.length,
    missingOrdersCount: missingOrders.length,
    groups,
  };
}
