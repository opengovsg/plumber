import { z } from 'zod'

import { parseS3Id } from '@/helpers/s3'

export const requestSchema = z.object({
  attachments: z.array(z.string()).transform((array, context) => {
    const result: string[] = []
    for (const value of array) {
      // Account for optional attachment fields with no response.
      if (!value) {
        continue
      }
      if (!parseS3Id(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${value} is not a S3 ID.`,
        })
        return z.NEVER
      }
      result.push(value)
    }
    return result
  }),
  infoToExtract: z
    .array(z.object({ infoToExtract: z.string() }))
    .transform((array) => {
      const result: Record<string, { description: string; type: string }> = {}
      array.forEach((a, index) => {
        result[`additionalProp${index}`] = {
          description: `Extract the ${a.infoToExtract}`,
          type: 'string',
        }
      })
      return result
    }),
})
