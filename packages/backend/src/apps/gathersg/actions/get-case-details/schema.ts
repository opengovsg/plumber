import { z } from 'zod'

export const dataOutSchema = z.object({
  data: z
    .object({
      fields: z.record(z.string(), z.any()).nullish(),
      formsg: z
        .object({
          formId: z.string().min(1),
          submissionId: z.string().min(1),
        })
        .nullish(),
      updatedBy: z
        .object({
          email: z.string().min(1).nullish(),
          name: z.string().min(1),
        })
        .nullish(),
      createdBy: z
        .object({
          email: z.string().min(1).nullish(),
          name: z.string().min(1),
        })
        .nullish(),
    })
    .nullish(),
})
