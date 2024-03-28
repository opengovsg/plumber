import { z } from 'zod'

export const templateSchema = z
  .object({
    templateId: z.number(),
    fields: z.array(z.string()),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .transform((data) => ({
    name: data.name,
    value: data.templateId.toString(),
  }))
