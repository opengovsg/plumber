import { z } from 'zod'

import { sanitizeMarkdown } from '@/apps/telegram-bot/common/markdown-v1'

function isStringifiedJSON(input: string) {
  if (typeof input !== 'string') {
    return false // If not a string, it can't be stringified JSON
  }

  try {
    // NOTE: assume that user is trying to input JSON data if it starts with { or ends with }
    if (input.startsWith('{') || input.endsWith('}')) {
      return true
    }

    const parsed = JSON.parse(input)
    return typeof parsed === 'object' && parsed !== null
  } catch (e) {
    return false // Not valid JSON
  }
}

export const requestSchema = z.object({
  customHeaders: z
    .array(
      z.object({
        // key cannot be null or empty
        key: z
          .string({
            required_error: 'Key empty',
            invalid_type_error: 'Key empty',
          })
          .trim()
          .min(1, 'Key empty'),
        // value optional in the event the substituted variable is empty
        value: z.string().trim().nullish().optional(),
      }),
    )
    .transform((params, context) => {
      const result = Object.create(null)
      const seenFields = new Set<string>()
      for (const { key, value } of params) {
        // no null keys are allowed
        if (!key) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Key empty',
          })
          return z.NEVER
        }
        // catch duplicate fields
        if (seenFields.has(key)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} key is repeated`,
            fatal: true,
          })
          return z.NEVER
        }
        seenFields.add(key)

        const cleanV = value?.replaceAll(/\r?\n|\r/g, ' ') || ''
        result[key] = sanitizeMarkdown(cleanV)
      }
      return result
    })
    .nullish(),
  data: z
    .string()
    .transform((str, ctx) => {
      // Allow empty string
      if (str === '') {
        return str
      }

      try {
        if (isStringifiedJSON(str)) {
          JSON.parse(str) // to test if it's valid JSON
          return str
        } else {
          // NOTE: caters for existing users that are sending strings in the data field
          // all non JSON-like inputs will be treated as string
          return str
        }
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid JSON data',
        })
        return z.NEVER
      }
    })
    .nullish(),
})
