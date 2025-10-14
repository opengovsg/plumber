import { z } from 'zod'

export const fieldTypeEnum = z.enum(['string', 'number', 'null'])

export const requestSchema = z.object({
  caseType: z.string().trim().min(1, 'Case type empty'),
  caseStatus: z.string().trim().optional(),
  caseFields: z.array(
    z.object({
      field: z.string().trim().min(1, 'Field empty'),
      value: z.string().trim().nullish(),
    }),
  ),
})

export const responseSchema = z.object({
  data: z.object({
    caseRef: z.string(),
    uuid: z.string(),
  }),
})
