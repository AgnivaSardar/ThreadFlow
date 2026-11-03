import { prisma } from '../../config/db';
import { AppError } from '../../common/errors/AppError';

export class ReportsService {
  /**
   * Compiles executive weekly summary metrics for a selected buyer organization.
   */
  static async getWeeklySummary(buyerId?: string) {
    // If no buyerId provided, default to first active buyer
    let resolvedBuyerId = buyerId;
    if (!resolvedBuyerId || resolvedBuyerId === 'ALL') {
      const firstBuyer = await prisma.buyer.findFirst({ orderBy: { name: 'asc' } });
      resolvedBuyerId = firstBuyer?.id;
    }

    if (!resolvedBuyerId) {
      throw new AppError('No buyer organization found', 404);
    }

    const buyer = await prisma.buyer.findUnique({
      where: { id: resolvedBuyerId },
      include: {
        orders: {
          where: { deletedAt: null },
          include: {
            unit: true,
            milestones: {
              where: { deletedAt: null },
              orderBy: { sequenceOrder: 'asc' },
            },
            riskWarnings: {
              where: { approvalStatus: 'CONFIRMED' },
              orderBy: { createdAt: 'desc' },
            },
            productionUpdates: {
              orderBy: { clientEventAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { exFactoryDate: 'asc' },
        },
      },
    });

    if (!buyer) {
      throw new AppError('Buyer organization not found', 404);
    }

    const orders = buyer.orders;
    const totalContractedPieces = orders.reduce((sum, o) => sum + o.totalQuantity, 0);
    const completedOrders = orders.filter((o) => {
      const lastMs = o.milestones[o.milestones.length - 1];
      return lastMs && lastMs.completedQuantity >= lastMs.targetQuantity;
    }).length;

    // Stage bottleneck counts
    const stageBreakdown: Record<string, { totalPlanned: number; totalCompleted: number }> = {
      KNITTING: { totalPlanned: 0, totalCompleted: 0 },
      DYEING_WASHING: { totalPlanned: 0, totalCompleted: 0 },
      PRINTING: { totalPlanned: 0, totalCompleted: 0 },
      CUTTING: { totalPlanned: 0, totalCompleted: 0 },
      STITCHING: { totalPlanned: 0, totalCompleted: 0 },
      CHECKING: { totalPlanned: 0, totalCompleted: 0 },
      FINISHING: { totalPlanned: 0, totalCompleted: 0 },
    };

    orders.forEach((o) => {
      o.milestones.forEach((m) => {
        if (stageBreakdown[m.stage]) {
          stageBreakdown[m.stage].totalPlanned += m.targetQuantity;
          stageBreakdown[m.stage].totalCompleted += m.completedQuantity;
        }
      });
    });

    // Recent archive reports
    const archives = await prisma.weeklyBuyerReport.findMany({
      where: { buyerId: resolvedBuyerId },
      orderBy: { generatedAt: 'desc' },
      take: 10,
    });

    return {
      buyer: {
        id: buyer.id,
        name: buyer.name,
        code: buyer.code,
        country: buyer.country,
        contactEmail: buyer.contactEmail,
      },
      metrics: {
        totalOrders: orders.length,
        activeOrders: orders.length - completedOrders,
        completedOrders,
        totalContractedPieces,
        onTimeConfidencePercent: orders.length > 0 ? Math.round(((orders.length - orders.filter(o => o.riskWarnings.length > 0).length) / orders.length) * 100) : 100,
      },
      stageBreakdown,
      orders: orders.map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        style: o.style,
        totalQuantity: o.totalQuantity,
        currency: o.currency,
        exFactoryDate: o.exFactoryDate,
        unitName: o.unit.name,
        activeStage: o.milestones.find((m) => m.completedQuantity < m.targetQuantity)?.stage || 'FINISHING',
        confirmedMitigations: o.riskWarnings.map((rw) => rw.mitigationPlan).filter(Boolean),
        latestNote: o.productionUpdates[0]?.notes || 'Running on schedule',
      })),
      archives,
    };
  }

  /**
   * Creates an archived weekly report snapshot.
   */
  static async saveWeeklyReportSnapshot(buyerId: string, weekNumber: number, year: number, userId?: string) {
    const summary = await ReportsService.getWeeklySummary(buyerId);

    const report = await prisma.weeklyBuyerReport.create({
      data: {
        buyerId,
        weekNumber,
        year,
        fileFormat: 'PDF',
        reportUrl: `/reports/export/${buyerId}/${year}/CW${weekNumber}`,
        summarySnapshot: JSON.stringify(summary),
        orderCount: summary.metrics.totalOrders,
        generatedById: userId || null,
      },
    });

    return report;
  }
}
