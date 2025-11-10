import z from 'zod/v3'

export const schema = z.object({
  promptType: z.enum(['analyse', 'categorise', 'summarise', 'write', 'custom']),
  prompt: z.string().min(1),
  responseFormat: z
    .enum(['singleField', 'multipleFields'])
    .default('singleField'),
})
