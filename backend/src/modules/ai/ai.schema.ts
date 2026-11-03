import { z } from 'zod';
import { IssueCategory } from '@prisma/client';

export const classifyNoteSchema = z.object({
  body: z.object({
    rawText: z.string().min(1, 'Raw floor text is required').max(2000, 'Text exceeds 2000 characters limit'),
    timeoutMs: z.number().int().positive().optional().default(3000),
    skipLlm: z.boolean().optional().default(false),
    orderId: z.string().optional(),
    productionUpdateId: z.string().optional(),
    context: z
      .object({
        style: z.string().optional(),
        stage: z.string().optional(),
        sizes: z.array(z.string()).optional(),
        colors: z.array(z.string()).optional(),
        orderLines: z
          .array(
            z.object({
              id: z.string(),
              size: z.string(),
              color: z.string().optional(),
              plannedQty: z.number().optional(),
              completedQty: z.number().optional(),
            })
          )
          .optional(),
      })
      .optional(),
  }),
});

export const getIssuesQueueSchema = z.object({
  query: z.object({
    needsReview: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    isConfirmed: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    category: z.nativeEnum(IssueCategory).optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20)),
  }),
});

export const overrideIssueSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
  }),
  body: z.object({
    newCategory: z.nativeEnum(IssueCategory, {
      errorMap: () => ({ message: 'Invalid IssueCategory provided' }),
    }),
    reason: z.string().max(500).optional(),
  }),
});

export const confirmIssueSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
  }),
});

export const assistantChatSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(2000),
        })
      )
      .optional()
      .default([]),
  }),
});
