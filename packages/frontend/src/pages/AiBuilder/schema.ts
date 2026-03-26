import z from 'zod'

export const AI_FORM_SCHEMA = z.object({
  flowName: z.string().trim().min(1, 'Flow name is required'),
  trigger: z.string().trim(),
  actions: z
    .string()
    .trim()
    .min(30, 'Description must be at least 30 characters')
    .max(3000, 'Description must not exceed 3000 characters'),
})

export type AiFormData = z.infer<typeof AI_FORM_SCHEMA>
