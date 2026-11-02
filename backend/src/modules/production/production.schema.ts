import { z } from 'zod';
import { Stage, IssueCategory } from '@prisma/client';

export const createProductionUpdateBodySchema = z.object({
  idempotencyKey: z
    .string({ required_error: 'Idempotency key is required' })
    .min(1, 'Idempotency key cannot be empty'),
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .min(1, 'Order ID cannot be empty'),
  milestoneId: z
    .string({ required_error: 'Milestone ID is required' })
    .min(1, 'Milestone ID cannot be empty'),
  stage: z.nativeEnum(Stage, {
    errorMap: () => ({ message: 'Invalid production stage' }),
  }),
  shift: z.enum(['DAY', 'NIGHT']).optional().default('DAY'),
  machineLine: z.string().optional().nullable(),
  goodQuantity: z
    .number({ required_error: 'Good quantity is required' })
    .int('Good quantity must be an integer')
    .min(0, 'Good quantity cannot be negative'),
  rejectedQuantity: z
    .number()
    .int('Rejected quantity must be an integer')
    .min(0, 'Rejected quantity cannot be negative')
    .optional()
    .default(0),
  notes: z.string().optional().nullable(),
  issueCategory: z.nativeEnum(IssueCategory).optional().nullable(),
  compressedPhotoBase64: z.string().optional().nullable(),
  clientEventAt: z.string().optional().nullable(),
  sizeBreakdownLines: z
    .array(
      z.object({
        orderLineId: z.string().min(1),
        goodQuantity: z.number().int().min(0),
        rejectedQuantity: z.number().int().min(0).default(0),
      })
    )
    .optional(),
});

export const createProductionUpdateSchema = z.object({
  body: createProductionUpdateBodySchema,
});

export type CreateProductionUpdateInput = z.infer<typeof createProductionUpdateBodySchema>;
