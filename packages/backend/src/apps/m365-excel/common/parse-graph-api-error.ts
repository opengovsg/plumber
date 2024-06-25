import z from 'zod'

import type HttpError from '@/errors/http'

const graphApiErrorSchema = z.object({
  code: z.string().trim(),
  message: z.string().trim().optional(),
  innerError: z
    .object({
      code: z.string().trim().optional(),
      message: z.string().trim().optional(),
    })
    .optional(),
})

/**
 * Helper function to parse Graph API errors, according to the MS' spec
 * https://learn.microsoft.com/en-us/graph/workbook-error-handling
 *
 * This only parses the top level and 2nd level errors. It returns null if there
 * was a parsing error.
 */
export function tryParseGraphApiError(
  err: HttpError,
): z.infer<typeof graphApiErrorSchema> | null {
  try {
    return graphApiErrorSchema.parse(err.response?.data?.error)
  } catch {
    return null
  }
}
