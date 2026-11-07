import { Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../common/errors/AppError';
import { calculateAuditHash } from '../../common/utils/crypto';
import { AuthenticatedUser } from '../../common/types/express';
import { getSystemToday } from '../../common/utils/dates';

export class BuyerPortalService {
  /**
   * Retrieves the buyer organization profile.
   * Strictly enforces buyerId matching the authenticated buyer user.
   */
  static async getBuyerProfile(buyerId: string) {
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      include: {
        _count: {
          select: {
            orders: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!buyer) {
      throw new AppError('Buyer organization not found', 404);
    }

    return {
      id: buyer.id,
      name: buyer.name,
      code: buyer.code,
      country: buyer.country,
      contactEmail: buyer.contactEmail,
      activeOrderCount: buyer._count.orders,
      createdAt: buyer.createdAt,
    };
  }

  /**
   * Lists orders strictly scoped to the authenticated buyer organization.
   * Filters risk alerts: WHERE approvalStatus = 'CONFIRMED' AND isBuyerVisible = true.
   * Filters photos: WHERE approvalStatus = 'CONFIRMED' AND isBuyerVisible = true.
   * Includes the latest production update/log of each order and all buyer responses.
   */
  static async getBuyerOrders(buyerId: string, search?: string) {
    const whereClause: any = {
      buyerId,
      deletedAt: null,
    };

    if (search && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { poNumber: { contains: term, mode: 'insensitive' } },
        { style: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        buyer: true,
        unit: true,
        orderLines: true,
        milestones: {
          where: { deletedAt: null },
          orderBy: { sequenceOrder: 'asc' },
        },
        riskWarnings: {
          where: {
            approvalStatus: 'CONFIRMED',
            isBuyerVisible: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        auditEvents: {
          where: {
            action: 'BUYER_DAILY_RESPONSE',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { timestamp: 'desc' },
        },
        productionUpdates: {
          include: {
            supervisor: {
              select: {
                id: true,
                name: true,
              },
            },
            issueClassification: true,
            photos: {
              where: {
                approvalStatus: 'CONFIRMED',
                isBuyerVisible: true,
              },
            },
          },
          orderBy: { clientEventAt: 'desc' },
        },
      },
      orderBy: { exFactoryDate: 'asc' },
    });

    return orders.map((order) => {
      // Aggregate approved photos across all production updates
      const approvedPhotos = order.productionUpdates.flatMap((pu) =>
        pu.photos.map((photo) => ({
          id: photo.id,
          s3Url: photo.s3Url,
          stage: photo.stage,
          timestamp: photo.createdAt,
          shift: pu.shift || 'DAY',
          machineLine: pu.machineLine || 'Line 1',
        }))
      );

      // Latest daily work log for this order strictly translated into English for buyers
      const latestUpdate = order.productionUpdates[0] || null;
      const classification = latestUpdate?.issueClassification;
      const cleanRawNotes = latestUpdate?.notes
        ? latestUpdate.notes.replace(/\s*\[English:\s*Unclassified floor note\]/gi, '').trim()
        : '';

      const isTamil = /[\u0B80-\u0BFF]/.test(cleanRawNotes);
      let englishNotes = cleanRawNotes;
      if (isTamil || !englishNotes) {
        englishNotes =
          classification?.translatedText ||
          (classification as any)?.cleanEnglishNote ||
          (classification?.category && classification.category !== 'OTHER'
            ? `Operational update: ${classification.category.replace(/_/g, ' ')} reported on line.`
            : 'Floor operations running as scheduled.');
      } else if (classification?.translatedText && classification.confidenceScore >= 0.8) {
        englishNotes = classification.translatedText;
      }

      const latestDailyLog = latestUpdate
        ? {
            id: latestUpdate.id,
            stage: latestUpdate.stage,
            shift: latestUpdate.shift || 'DAY',
            machineLine: latestUpdate.machineLine || 'Line 1',
            goodQuantity: latestUpdate.goodQuantity,
            rejectedQuantity: latestUpdate.rejectedQuantity,
            notes: englishNotes,
            timestamp: latestUpdate.clientEventAt || latestUpdate.createdAt,
            supervisorName: latestUpdate.supervisor?.name || 'Floor Supervisor',
            photosCount: latestUpdate.photos.length,
          }
        : null;

      // Buyer responses logged for this order
      const buyerResponses = order.auditEvents.map((evt) => ({
        id: evt.id,
        message: evt.notes || '',
        timestamp: evt.timestamp,
        userName: evt.user.name,
        userEmail: evt.user.email,
        entityId: evt.entityId,
      }));

      // Milestone progress evaluation
      const totalStages = order.milestones.length || 7;
      const completedStages = order.milestones.filter(
        (m) => m.completedQuantity >= m.targetQuantity && m.targetQuantity > 0
      ).length;
      const progressPercent = Math.min(
        100,
        Math.round((completedStages / Math.max(1, totalStages)) * 100)
      );

      // Compute current active stage
      const activeMilestone =
        order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        order.milestones[order.milestones.length - 1];

      // Ex-factory countdown
      const today = getSystemToday();
      const exFactory = new Date(order.exFactoryDate);
      const diffMs = exFactory.getTime() - today.getTime();
      const daysToExFactory = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return {
        id: order.id,
        poNumber: order.poNumber,
        style: order.style,
        description: order.description,
        totalQuantity: order.totalQuantity,
        currency: order.currency,
        exchangeRate: order.exchangeRate,
        fobPricePerPiece: order.fobPricePerPiece,
        totalOrderValue: order.totalOrderValue,
        orderDate: order.orderDate,
        exFactoryDate: order.exFactoryDate,
        daysToExFactory,
        activeStage: activeMilestone?.stage || 'FINISHING',
        progressPercent,
        completedStages,
        totalStages,
        unit: {
          id: order.unit.id,
          name: order.unit.name,
          code: order.unit.code,
          location: order.unit.location,
        },
        milestones: order.milestones.map((m) => ({
          id: m.id,
          stage: m.stage,
          sequenceOrder: m.sequenceOrder,
          plannedStart: m.plannedStart,
          plannedEnd: m.plannedEnd,
          targetQuantity: m.targetQuantity,
          completedQuantity: m.completedQuantity,
          isCompleted: m.completedQuantity >= m.targetQuantity && m.targetQuantity > 0,
        })),
        confirmedAlerts: order.riskWarnings.map((rw) => ({
          id: rw.id,
          stage: order.milestones.find((m) => m.id === rw.milestoneId)?.stage || 'CUTTING',
          riskLevel: rw.riskLevel,
          mitigationPlan: rw.mitigationPlan,
          reviewedAt: rw.reviewedAt || rw.createdAt,
          daysLate: rw.daysLate,
        })),
        approvedPhotos,
        latestDailyLog,
        buyerResponses,
      };
    });
  }

  /**
   * Retrieves single order detail strictly scoped to the authenticated buyer organization.
   * Returns 404/403 if order.buyerId !== req.user.buyerId.
   */
  static async getBuyerOrderById(buyerId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        unit: true,
        orderLines: true,
        milestones: {
          where: { deletedAt: null },
          orderBy: { sequenceOrder: 'asc' },
        },
        riskWarnings: {
          where: {
            approvalStatus: 'CONFIRMED',
            isBuyerVisible: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        auditEvents: {
          where: {
            action: 'BUYER_DAILY_RESPONSE',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { timestamp: 'desc' },
        },
        productionUpdates: {
          include: {
            supervisor: {
              select: {
                id: true,
                name: true,
              },
            },
            issueClassification: true,
            photos: {
              where: {
                approvalStatus: 'CONFIRMED',
                isBuyerVisible: true,
              },
            },
          },
          orderBy: { clientEventAt: 'desc' },
        },
      },
    });

    if (!order || order.deletedAt) {
      throw new AppError('Order not found', 404);
    }

    // Strict multi-tenant authorization check
    if (order.buyerId !== buyerId) {
      throw new AppError('Forbidden: Order does not belong to your organization', 403);
    }

    // Aggregate approved photos
    const approvedPhotos = order.productionUpdates.flatMap((pu) =>
      pu.photos.map((photo) => ({
        id: photo.id,
        s3Url: photo.s3Url,
        stage: photo.stage,
        timestamp: photo.createdAt,
        shift: pu.shift || 'DAY',
        machineLine: pu.machineLine || 'Line 1',
      }))
    );

    const latestUpdate = order.productionUpdates[0] || null;
    const classification = latestUpdate?.issueClassification;
    const cleanRawNotes = latestUpdate?.notes
      ? latestUpdate.notes.replace(/\s*\[English:\s*Unclassified floor note\]/gi, '').trim()
      : '';

    const isTamil = /[\u0B80-\u0BFF]/.test(cleanRawNotes);
    let englishNotes = cleanRawNotes;
    if (isTamil || !englishNotes) {
      englishNotes =
        classification?.translatedText ||
        (classification as any)?.cleanEnglishNote ||
        (classification?.category && classification.category !== 'OTHER'
          ? `Operational update: ${classification.category.replace(/_/g, ' ')} reported on line.`
          : 'Floor operations running as scheduled.');
    } else if (classification?.translatedText && classification.confidenceScore >= 0.8) {
      englishNotes = classification.translatedText;
    }

    const latestDailyLog = latestUpdate
      ? {
          id: latestUpdate.id,
          stage: latestUpdate.stage,
          shift: latestUpdate.shift || 'DAY',
          machineLine: latestUpdate.machineLine || 'Line 1',
          goodQuantity: latestUpdate.goodQuantity,
          rejectedQuantity: latestUpdate.rejectedQuantity,
          notes: englishNotes,
          timestamp: latestUpdate.clientEventAt || latestUpdate.createdAt,
          supervisorName: latestUpdate.supervisor?.name || 'Floor Supervisor',
          photosCount: latestUpdate.photos.length,
        }
      : null;

    const buyerResponses = order.auditEvents.map((evt) => ({
      id: evt.id,
      message: evt.notes || '',
      timestamp: evt.timestamp,
      userName: evt.user.name,
      userEmail: evt.user.email,
      entityId: evt.entityId,
    }));

    const totalStages = order.milestones.length || 7;
    const completedStages = order.milestones.filter(
      (m) => m.completedQuantity >= m.targetQuantity && m.targetQuantity > 0
    ).length;
    const progressPercent = Math.min(
      100,
      Math.round((completedStages / Math.max(1, totalStages)) * 100)
    );

    const activeMilestone =
      order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
      order.milestones[order.milestones.length - 1];

    const today = getSystemToday();
    const exFactory = new Date(order.exFactoryDate);
    const diffMs = exFactory.getTime() - today.getTime();
    const daysToExFactory = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      id: order.id,
      poNumber: order.poNumber,
      style: order.style,
      description: order.description,
      totalQuantity: order.totalQuantity,
      currency: order.currency,
      exchangeRate: order.exchangeRate,
      fobPricePerPiece: order.fobPricePerPiece,
      totalOrderValue: order.totalOrderValue,
      orderDate: order.orderDate,
      exFactoryDate: order.exFactoryDate,
      daysToExFactory,
      activeStage: activeMilestone?.stage || 'FINISHING',
      progressPercent,
      completedStages,
      totalStages,
      unit: {
        id: order.unit.id,
        name: order.unit.name,
        code: order.unit.code,
        location: order.unit.location,
      },
      orderLines: order.orderLines.map((line) => ({
        id: line.id,
        color: line.color,
        size: line.size,
        plannedQty: line.plannedQty,
        completedQty: line.completedQty,
      })),
      milestones: order.milestones.map((m) => ({
        id: m.id,
        stage: m.stage,
        sequenceOrder: m.sequenceOrder,
        plannedStart: m.plannedStart,
        plannedEnd: m.plannedEnd,
        targetQuantity: m.targetQuantity,
        completedQuantity: m.completedQuantity,
        isCompleted: m.completedQuantity >= m.targetQuantity && m.targetQuantity > 0,
      })),
      confirmedAlerts: order.riskWarnings.map((rw) => ({
        id: rw.id,
        stage: order.milestones.find((m) => m.id === rw.milestoneId)?.stage || 'CUTTING',
        riskLevel: rw.riskLevel,
        mitigationPlan: rw.mitigationPlan,
        reviewedAt: rw.reviewedAt || rw.createdAt,
        daysLate: rw.daysLate,
      })),
      approvedPhotos,
      latestDailyLog,
      buyerResponses,
    };
  }

  /**
   * Submits a formal buyer daily acknowledgement / response to an order's daily work log.
   * Records a cryptographic tamper-evident audit event visible across ThreadFlow.
   */
  static async postBuyerFeedback(
    buyerId: string,
    orderId: string,
    user: AuthenticatedUser,
    message: string,
    productionUpdateId?: string
  ) {
    if (!message || !message.trim()) {
      throw new AppError('Feedback response text is required', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, poNumber: true },
    });

    if (!order || order.buyerId !== buyerId) {
      throw new AppError('Forbidden: Order does not belong to your organization', 403);
    }

    const timestamp = new Date().toISOString();
    const lastAudit = await prisma.auditEvent.findFirst({
      where: { orderId },
      orderBy: { timestamp: 'desc' },
    });

    const auditHash = calculateAuditHash(
      lastAudit?.auditHash || null,
      orderId,
      'BUYER_DAILY_RESPONSE',
      'DAILY_SHIFT_FEEDBACK',
      timestamp,
      null
    );

    const event = await prisma.auditEvent.create({
      data: {
        entityType: productionUpdateId ? 'ProductionUpdate' : 'Order',
        entityId: productionUpdateId || orderId,
        orderId,
        action: 'BUYER_DAILY_RESPONSE',
        category: 'STAGE_OUTPUT',
        reasonCode: 'DAILY_SHIFT_FEEDBACK',
        notes: message.trim(),
        newValue: JSON.stringify({
          feedbackText: message.trim(),
          productionUpdateId: productionUpdateId || null,
          poNumber: order.poNumber,
          buyerId,
          role: user.role,
        }),
        financialImpactRupees: 0,
        auditHash,
        userId: user.id,
        userRole: user.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return {
      id: event.id,
      orderId,
      message: event.notes,
      timestamp: event.timestamp,
      userName: event.user.name,
      userEmail: event.user.email,
    };
  }
}
