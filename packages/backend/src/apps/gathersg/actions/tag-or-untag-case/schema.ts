import { z } from 'zod'
import { CASE_UUID_REGEX } from '../../common/constants'

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
