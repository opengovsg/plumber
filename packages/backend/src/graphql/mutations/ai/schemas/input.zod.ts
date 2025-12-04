import { z } from 'zod/v3'

export const INPUT_SCHEMA = z.object({
  prompt: z
    .string()
    .trim()
    .min(15, 'Prompt must be at least 15 characters')
    .max(3000, 'Prompt must not exceed 3000 characters'),
  isFormMode: z.boolean(),
  sessionId: z.string().nullish(),
})

export const REFINE_FORM_INPUT_SCHEMA = z.object({
  prompt: z
    .string()
    .trim()
    .min(15, 'Prompt must be at least 15 characters')
    .max(3000, 'Prompt must not exceed 3000 characters'),
  sessionId: z.string().nullish(),
})
