import { z } from 'zod/v3'

export const INPUT_SCHEMA = z.object({
  trigger: z
    .string()
    .trim()
    .min(15, 'Description must be at least 15 characters')
    .max(250, 'Description must not exceed 250 characters'),
  actions: z
    .string()
    .trim()
    .min(30, 'Description must be at least 30 characters')
    .max(3000, 'Description must not exceed 3000 characters'),
})
