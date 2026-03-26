import { z } from 'zod'

import { CASE_UUID_REGEX } from '../../common/constants'
import { caseFieldsSchema } from '../../common/schema'

export const requestSchema = z
  .object({
    caseUuid: z
      .string()
      .trim()
      .min(1, {
        message: 'Please do not leave the case uuid empty',
      })
      .regex(CASE_UUID_REGEX, {
        message: 'Please enter a valid case uuid',
      }),
    caseStatus: z.string().trim().optional(),
    caseFields: caseFieldsSchema,
  })
  .transform((data) => ({
    caseUuid: data.caseUuid,
    ...(data.caseStatus && { status: data.caseStatus }),
    fields: data.caseFields,
  }))

// TODO: See if its possible to get more data from the response in the future if necessary
export const responseSchema = z.object({
  traceId: z.string(),
})
