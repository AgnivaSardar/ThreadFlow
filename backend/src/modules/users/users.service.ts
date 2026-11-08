import bcrypt from 'bcryptjs';
import { prisma } from '../../config/db';
import { Role, Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { AuthenticatedUser } from '../../common/types/express';
import { calculateAuditHash } from '../../common/utils/crypto';

export interface CreateMemberInput {
  name: string;
  email: string;
  role: Role;
  phone?: string;
  password?: string;
  languagePreference?: string;
  assignedUnitId?: string;
  buyerId?: string;
}

export interface UpdateSupervisorInput {
  assignedUnitId: string;
  phone?: string;
  languagePreference?: string;
  shiftName?: string;
  shiftTiming?: string;
  notingFrequency?: string;
  assignedLines?: string;
}

export class UsersService {
  /**
   * Retrieves dropdown metadata (all units and buyers)
   */
  static async getMetadata() {
    const [units, buyers] = await Promise.all([
      prisma.unit.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, name: true, code: true, type: true, location: true },
      }),
      prisma.buyer.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, country: true },
      }),
    ]);

    return { units, buyers };
  }

  /**
   * Creates a new user member (Admin-only action)
   */
  static async createMember(data: CreateMemberInput, creator: AuthenticatedUser) {
    const trimmedEmail = data.email.trim().toLowerCase();
    const trimmedName = data.name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      throw new AppError('Full name is required (minimum 2 characters)', 400);
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new AppError('Valid email address is required', 400);
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });
    if (existing) {
      throw new AppError(`User with email "${trimmedEmail}" already exists.`, 409);
    }

    // Role-specific validations
    if (data.role === Role.SUPERVISOR && data.assignedUnitId) {
      const unit = await prisma.unit.findUnique({ where: { id: data.assignedUnitId } });
      if (!unit) {
        throw new AppError('Selected manufacturing unit does not exist', 400);
      }
    }

    if (data.role === Role.BUYER && data.buyerId) {
      const buyer = await prisma.buyer.findUnique({ where: { id: data.buyerId } });
      if (!buyer) {
        throw new AppError('Selected buyer organization does not exist', 400);
      }
    }

    const rawPassword = data.password && data.password.trim() ? data.password.trim() : 'ThreadFlow@2026';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        passwordHash,
        role: data.role,
        phone: data.phone?.trim() || null,
        languagePreference: data.languagePreference || (data.role === Role.SUPERVISOR ? 'ta' : 'en'),
        assignedUnitId: data.role === Role.SUPERVISOR ? data.assignedUnitId || null : null,
        buyerId: data.role === Role.BUYER ? data.buyerId || null : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        languagePreference: true,
        assignedUnitId: true,
        buyerId: true,
        createdAt: true,
        assignedUnit: { select: { id: true, name: true, code: true, type: true } },
        buyer: { select: { id: true, name: true, code: true } },
      },
    });

    // Record audit event
    try {
      const prevAudit = await prisma.auditEvent.findFirst({ orderBy: { timestamp: 'desc' } });
      const previousHash = prevAudit?.auditHash || 'ROOT';
      const eventTimestamp = new Date();
      const auditHash = calculateAuditHash(
        previousHash,
        user.id,
        'CREATE_USER',
        'NEW_STAFF_ONBOARDING',
        eventTimestamp.toISOString(),
        0
      );

      await prisma.auditEvent.create({
        data: {
          action: 'CREATE_USER',
          category: 'ACCESS_CONTROL',
          reasonCode: 'NEW_STAFF_ONBOARDING',
          notes: `Member created: ${user.name} (${user.role}) - ${user.email}`,
          userId: creator.id,
          userRole: creator.role,
          entityType: 'USER',
          entityId: user.id,
          auditHash,
          timestamp: eventTimestamp,
        },
      });
    } catch (auditErr) {
      console.warn('Non-blocking audit log creation error on createMember:', auditErr);
    }

    return user;
  }

  /**
   * Lists all supervisors with their assigned units and currently active floor work orders
   */
  static async listSupervisors() {
    const [supervisors, units, allActiveOrders] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.SUPERVISOR },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          languagePreference: true,
          assignedUnitId: true,
          assignedUnit: { select: { id: true, name: true, code: true, type: true, location: true } },
        },
      }),
      prisma.unit.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, name: true, code: true, type: true, location: true },
      }),
      prisma.order.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        orderBy: { exFactoryDate: 'asc' },
        select: {
          id: true,
          poNumber: true,
          style: true,
          totalQuantity: true,
          unitId: true,
          buyer: { select: { name: true, code: true } },
          milestones: {
            orderBy: { sequenceOrder: 'asc' },
            select: { stage: true, targetQuantity: true, completedQuantity: true },
          },
        },
      }),
    ]);

    // Map active floor work orders per unit
    const activeOrdersByUnit: Record<string, any[]> = {};
    for (const ord of allActiveOrders) {
      if (!ord.unitId) continue;
      if (!activeOrdersByUnit[ord.unitId]) {
        activeOrdersByUnit[ord.unitId] = [];
      }
      const activeMs = ord.milestones.find((m) => m.completedQuantity < m.targetQuantity) || ord.milestones[ord.milestones.length - 1];
      const isCompleted = ord.milestones.every((m) => m.completedQuantity >= m.targetQuantity);
      if (!isCompleted) {
        activeOrdersByUnit[ord.unitId].push({
          orderId: ord.id,
          poNumber: ord.poNumber,
          style: ord.style,
          totalQuantity: ord.totalQuantity,
          buyerName: ord.buyer?.name || '',
          activeStage: activeMs?.stage || 'PRODUCTION',
          completedQuantity: activeMs?.completedQuantity || 0,
          targetQuantity: activeMs?.targetQuantity || ord.totalQuantity,
        });
      }
    }

    const supervisorsWithWork = supervisors.map((s) => ({
      ...s,
      floorOrders: s.assignedUnitId ? activeOrdersByUnit[s.assignedUnitId] || [] : [],
    }));

    return {
      supervisors: supervisorsWithWork,
      units,
      activeOrdersByUnit,
    };
  }

  /**
   * Updates supervisor floor work assignment and shift details
   */
  static async updateSupervisorAssignment(
    supervisorId: string,
    data: UpdateSupervisorInput,
    updater: AuthenticatedUser
  ) {
    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      include: { assignedUnit: true },
    });

    if (!supervisor) {
      throw new AppError('Supervisor not found', 404);
    }

    if (supervisor.role !== Role.SUPERVISOR) {
      throw new AppError('Target user is not a floor supervisor', 400);
    }

    const targetUnit = await prisma.unit.findUnique({
      where: { id: data.assignedUnitId },
    });

    if (!targetUnit) {
      throw new AppError('Selected manufacturing unit does not exist', 400);
    }

    const updatedSupervisor = await prisma.user.update({
      where: { id: supervisorId },
      data: {
        assignedUnitId: data.assignedUnitId,
        ...(data.phone ? { phone: data.phone.trim() } : {}),
        ...(data.languagePreference ? { languagePreference: data.languagePreference } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        languagePreference: true,
        assignedUnitId: true,
        assignedUnit: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    // Record audit event for supervisor floor assignment
    try {
      const prevAudit = await prisma.auditEvent.findFirst({ orderBy: { timestamp: 'desc' } });
      const previousHash = prevAudit?.auditHash || 'ROOT';
      const eventTimestamp = new Date();
      const auditHash = calculateAuditHash(
        previousHash,
        supervisor.id,
        'UPDATE_SUPERVISOR_ASSIGNMENT',
        'FLOOR_WORK_REASSIGNMENT',
        eventTimestamp.toISOString(),
        0
      );

      const shiftInfo = data.shiftName ? ` (Shift: ${data.shiftName}${data.shiftTiming ? ` - ${data.shiftTiming}` : ''})` : '';
      const notes = `Supervisor ${supervisor.name} assigned to floor: ${targetUnit.name} (${targetUnit.code})${shiftInfo}. Reassigned by ${updater.email} (${updater.role}).`;

      await prisma.auditEvent.create({
        data: {
          action: 'UPDATE_SUPERVISOR_ASSIGNMENT',
          category: 'ACCESS_CONTROL',
          reasonCode: 'FLOOR_WORK_REASSIGNMENT',
          notes,
          userId: updater.id,
          userRole: updater.role,
          entityType: 'USER',
          entityId: supervisor.id,
          auditHash,
          timestamp: eventTimestamp,
        },
      });
    } catch (auditErr) {
      console.warn('Non-blocking audit log creation error on updateSupervisorAssignment:', auditErr);
    }

    return updatedSupervisor;
  }
}
