import { z } from 'zod'

export const parametersSchema = z.object({
  query: z.string().min(1),
})

export const dataOutSchema = z.object({
  data: z.object({
    response: z.object({
      content: z.string(),
    }),
  }),
})
