import { z } from 'zod'

import { caseIdentifierSchema } from '../../common/case-identifier'

export const requestSchema = z
  .object({
    caseUuid: caseIdentifierSchema,
    tagOrUntag: z.boolean(),
    tagValue: z.string().trim().min(1, {
      message: 'Please do not leave the tag empty',
    }),
  })
  .transform((data) => ({
    caseUuid: data.caseUuid,
    tagOrUntag: data.tagOrUntag,
    tag: data.tagValue,
  }))

// TODO: See if its possible to get more data from the response in the future if necessary
export const responseSchema = z.object({
  traceId: z.string(),
})
