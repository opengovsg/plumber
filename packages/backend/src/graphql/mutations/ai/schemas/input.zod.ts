import { z } from 'zod/v3'

export const INPUT_SCHEMA = z.object({
  prompt: z
    .string()
    .trim()
    .min(15, 'Prompt must be at least 15 characters')
    .max(10000, 'Prompt must not exceed 10000 characters'),
  sessionId: z.string().nullish(),
  traceId: z.string().nullish(),
})
