import { z } from 'zod'

export const dataOutSchema = z.object({
  data: z
    .object({
      type: z.object({
        name: z.string().min(1),
        uuid: z.string().min(1),
        slaDay: z.number().nullish(),
      }),
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
      tags: z.array(z.string()).nullish(),
      attachments: z
        .array(
          z.object({
            attachmentUuid: z.string().min(1),
            name: z.string().min(1),
            mimeType: z.string().min(1),
            size: z.number(),
            s3Id: z.string().min(1).optional(),
          }),
        )
        .nullish(),
      email: z.record(z.string(), z.any()).nullish(),
    })
    .nullish(),
  traceId: z.string().min(1),
})
