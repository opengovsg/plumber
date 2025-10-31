import { z } from 'zod/v3'

export const INPUT_SCHEMA = z.object({
  trigger: z
    .string()
    .trim()
    .min(15, 'Trigger description must be at least 15 characters')
    .max(250, 'Trigger description must not exceed 250 characters'),
  actions: z
    .string()
    .trim()
    .min(30, 'Actions description must be at least 30 characters')
    .max(1000, 'Actions description must not exceed 1000 characters'),
})
