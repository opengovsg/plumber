import { z } from 'zod'

export const encryptionKeySchema = z
  .string()
  .min(12, {
    message: 'be at least 12 characters long',
  })
  .max(20, { message: 'be at most 20 characters long' })
  .regex(/[0-9]/, {
    message: 'contain at least 1 number',
  })
  .regex(/[A-Z]/, {
    message: 'contain at least 1 uppercase letter',
  })
  .regex(/[^A-Za-z0-9\s]/, {
    message: 'contain at least 1 special character',
  })
  // Do not allow leading or trailing whitespace
  .refine((value) => value === value.trim(), {
    message: 'not have leading or trailing whitespace',
  })

export const dataOutSchema = z.object({
  app: z.string().min(1),
  signature: z.string().min(1),
  timestamp: z.number(),
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
      finalisedBy: z
        .object({
          email: z.string().min(1).nullish(),
          name: z.string().min(1),
        })
        .nullish(),
      attachments: z
        .record(
          z.string(),
          z.object({
            name: z.string().min(1),
            mimeType: z.string().min(1),
            size: z.number(),
          }),
        )
        .nullish(),
    })
    .nullish(),
})
