import { z } from 'zod'

import { CASE_UUID_REGEX } from '../../common/constants'

export const fieldTypeEnum = z.enum(['string', 'number', 'null'])

export const requestSchema = z.object({
  caseUuid: z
    .string()
    .trim()
    .min(1, {
      message: 'Empty case uuid',
    })
    .regex(CASE_UUID_REGEX, {
      message: 'Invalid case uuid',
    }),
  caseStatus: z.string().trim().optional(),
  caseFields: z.array(
    z.object({
      field: z.string().trim().min(1, 'Field empty'),
      value: z.string().trim().nullish(),
    }),
  ),
})

// TODO: See if its possible to get more data from the response in the future if necessary
export const responseSchema = z.object({
  traceId: z.string(),
})
