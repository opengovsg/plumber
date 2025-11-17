import { z } from 'zod'

export const parametersSchema = z.object({
  apiKey: z.string().min(1),
  query: z.string().min(1),
})

export const dataOutSchema = z.object({
  data: z.object({
    response: z.object({
      content: z.string(),
    }),
  }),
})
