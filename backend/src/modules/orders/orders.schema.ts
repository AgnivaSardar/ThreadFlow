import { z } from 'zod';

export const REASON_CODES = [
  'BUYER_REQUEST',
  'FABRIC_DELAY',
  'LABOUR_SHORTAGE',
  'MACHINE_BREAKDOWN',
  'POWER_OUTAGE',
  'QUALITY_HOLD',
  'SUBCONTRACTOR_DELAY',
  'OTHER',
] as const;

export const createOrderSchema = z.object({
  body: z.object({
    poNumber: z
      .string({ required_error: 'PO Number is required' })
      .trim()
      .min(3, 'PO Number must be at least 3 characters')
      .max(50, 'PO Number cannot exceed 50 characters'),
    buyerId: z
      .string({ required_error: 'Buyer is required' })
      .min(1, 'Buyer ID is required'),
    unitId: z
      .string({ required_error: 'Manufacturing Unit is required' })
      .min(1, 'Manufacturing Unit ID is required'),
    style: z
      .string({ required_error: 'Style is required' })
      .trim()
      .min(2, 'Style must be at least 2 characters')
      .max(120, 'Style cannot exceed 120 characters'),
    description: z.string().trim().optional(),
    totalQuantity: z
      .number({ required_error: 'Total Quantity is required' })
      .int('Total Quantity must be an integer')
      .positive('Total Quantity must be greater than zero'),
    exFactoryDate: z
      .string({ required_error: 'Ex-Factory Date is required' })
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ex-Factory Date must be a valid ISO date',
      }),
    orderDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Order Date must be a valid ISO date',
      }),
    currency: z.string().trim().default('INR'),
    exchangeRate: z.number().positive().default(1.0),
    fobPricePerPiece: z.number().nonnegative().optional().default(0),
    sizeBreakdowns: z
      .array(
        z.object({
          size: z.string({ required_error: 'Size is required' }).trim().min(1),
          color: z.string({ required_error: 'Color is required' }).trim().min(1),
          plannedQty: z
            .number({ required_error: 'Planned quantity is required' })
            .int()
            .positive('Planned quantity must be greater than zero'),
        })
      )
      .min(1, 'At least one size breakdown item is required'),
  }).refine(
    (data) => {
      const sum = data.sizeBreakdowns.reduce((acc, curr) => acc + curr.plannedQty, 0);
      return sum === data.totalQuantity;
    },
    {
      message: 'The sum of size breakdown quantities must equal Total Quantity exactly',
      path: ['sizeBreakdowns'],
    }
  ),
});

export const updateExFactoryDateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    newExFactoryDate: z
      .string({ required_error: 'New Ex-Factory Date is required' })
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'New Ex-Factory Date must be a valid ISO date',
      }),
    reasonCode: z
      .string({ required_error: 'Reason code is required' })
      .trim()
      .min(1, 'Reason code cannot be empty'),
    notes: z.string().trim().optional(),
    financialImpactRupees: z.number().nonnegative().optional(),
  }),
});

export const bulkShiftExFactoryDateSchema = z.object({
  body: z
    .object({
      orderIds: z.array(z.string().min(1)).min(1, 'At least one order must be selected'),
      shiftDays: z.number().int().positive('Shift days must be a positive integer').optional(),
      newExFactoryDate: z
        .string()
        .optional()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
          message: 'New Ex-Factory Date must be a valid ISO date',
        }),
      reasonCode: z
        .string({ required_error: 'Reason code is required' })
        .trim()
        .min(1, 'Reason code cannot be empty'),
      notes: z.string().trim().optional(),
    })
    .refine((data) => data.shiftDays !== undefined || (data.newExFactoryDate !== undefined && data.newExFactoryDate.length > 0), {
      message: 'Either shiftDays or newExFactoryDate must be provided',
      path: ['shiftDays'],
    }),
});

export const orderQuerySchema = z.object({
  query: z.object({
    status: z.string().optional(),
    buyerId: z.string().optional(),
    unitId: z.string().optional(),
    shipWeek: z.string().optional(),
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const advanceStageSchema = z.object({
  body: z.object({
    fromStage: z.string({ required_error: 'Current stage is required' }),
    completedQuantity: z.number().int().nonnegative().optional(),
    adjustDownstreamTargets: z.boolean().default(true),
    reasonCode: z.string().min(1, 'Reason code is required'),
    overrideNotes: z.string().optional(),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type UpdateExFactoryDateInput = z.infer<typeof updateExFactoryDateSchema>['body'];
export type BulkShiftExFactoryDateInput = z.infer<typeof bulkShiftExFactoryDateSchema>['body'];
export type OrderQueryFilters = z.infer<typeof orderQuerySchema>['query'];
export type AdvanceStageInput = z.infer<typeof advanceStageSchema>['body'];
