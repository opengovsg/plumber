import { z } from 'zod'

export const requestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, { message: 'Empty prompt' })
    .max(32768, { message: 'Prompt is too long' }),
})

export const responseSchema = z.object({
  output: z.string(),
})
