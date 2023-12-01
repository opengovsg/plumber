import '@/config/app' // Force luxon locale settings, just in case.

import { DateTime } from 'luxon'
import { z } from 'zod'

/**
 * This file contains things needed to help us conform to a common internal date
 * format - dd MMM yyyy
 */

export const LUXON_FORMAT_STRING = 'dd MMM yyyy'

export const zodParser = z
  .string()
  .trim()
  .min(1, { message: 'Empty date' })
  .transform((value, context) => {
    const result = DateTime.fromFormat(value, LUXON_FORMAT_STRING)

    if (!result.isValid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Date not in "2-digit-day month 4-digit-year" (e.g. 02 Nov 2023) format',
      })

      return z.NEVER
    }

    return result
  })
