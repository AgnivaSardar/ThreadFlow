import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const magicLinkParamSchema = z.object({
  token: z.string().min(10, 'Invalid or malformed magic link token'),
});

export type LoginInput = z.infer<typeof loginSchema>;
