import { z } from 'zod'

import { caseFieldsSchema } from '../../common/schema'

export const requestSchema = z
  .object({
    caseType: z.string().trim().min(1, 'Case type empty'),
    caseStatus: z.string().trim().optional(),
    caseFields: caseFieldsSchema,
  })
  .transform((data) => ({
    caseType: data.caseType,
    ...(data.caseStatus && { status: data.caseStatus }),
    fields: data.caseFields,
  }))

export const responseSchema = z.object({
  data: z.object({
    caseRef: z.string(),
    uuid: z.string(),
  }),
})
