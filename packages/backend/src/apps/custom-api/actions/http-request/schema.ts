import { z } from 'zod'

import { sanitizeMarkdown } from '@/apps/telegram-bot/common/markdown-v1'

export const requestSchema = z.object({
  customHeaders: z
    .array(
      z.object({
        key: z.string().trim().min(1, 'Key empty').nullish(),
        value: z.string().trim().min(1, 'Value empty').nullish(),
      }),
    )
    .transform((params, context) => {
      const result = Object.create(null)
      const seenFields = new Set<string>()
      for (const { key, value } of params) {
        // no null fields or values are allowed
        if (!key) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Key empty',
          })
          return z.NEVER
        }
        if (!value) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Value empty',
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

        const cleanV = value.replaceAll(/\r?\n|\r/g, ' ')
        result[key] = sanitizeMarkdown(cleanV)
      }
      return result
    })
    .nullish(),
})
