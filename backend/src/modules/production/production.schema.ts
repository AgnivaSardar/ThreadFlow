import { z } from 'zod';
import { Stage, IssueCategory } from '@prisma/client';

export const createProductionUpdateBodySchema = z
  .object({
    idempotencyKey: z
      .string({ required_error: 'Idempotency key is required' })
      .uuid('Idempotency key must be a valid UUIDv4 format'),
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
          orderLineId: z.string().min(1, 'Order line ID cannot be empty'),
          goodQuantity: z
            .number()
            .int('Size good quantity must be an integer')
            .min(0, 'Size good quantity cannot be negative'),
          rejectedQuantity: z
            .number()
            .int('Size rejected quantity must be an integer')
            .min(0, 'Size rejected quantity cannot be negative')
            .default(0),
        })
      )
      .optional(),
  })
  .refine(
    (data) => data.goodQuantity > 0 || data.rejectedQuantity > 0,
    { message: 'At least one of good quantity or rejected quantity must be greater than zero' }
  );

export const createProductionUpdateSchema = z.object({
  body: createProductionUpdateBodySchema,
});

export const bulkProductionUpdateBodySchema = z.object({
  updates: z
    .array(createProductionUpdateBodySchema)
    .min(1, 'Bulk batch must contain at least one update')
    .max(100, 'Bulk batch cannot exceed 100 updates per request'),
});

export const bulkProductionUpdateSchema = z.object({
  body: bulkProductionUpdateBodySchema,
});

export type CreateProductionUpdateInput = z.infer<typeof createProductionUpdateBodySchema>;
export type BulkProductionUpdateInput = z.infer<typeof bulkProductionUpdateBodySchema>;
