import z from 'zod'

import {
  outputFieldNameSchema,
  toSanitizedOutputFieldNamePair,
} from '../../common/schema'

export const schema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(10000, { message: 'Prompt cannot exceed 10,000 characters' }),
  responseFields: z
    .array(
      z
        .object({
          fieldName: outputFieldNameSchema,
          fieldType: z.enum(['text', 'number', 'category']),
          fieldCategories: z.string().optional(),
        })
        .transform((field) => ({
          ...toSanitizedOutputFieldNamePair(field.fieldName),
          fieldType: field.fieldType,
          fieldCategories: field.fieldCategories,
        }))
        .refine(
          (data: {
            fieldName?: string
            fieldType?: string
            fieldCategories?: string
          }) => {
            if (data.fieldType === 'category') {
              if (!data.fieldCategories) {
                return false
              }
              // Validate comma-separated values in a single pass
              const items = data.fieldCategories.split(',')
              const seen = new Set<string>()

              for (const item of items) {
                const trimmed = item.trim()

                // Check if empty
                if (trimmed.length === 0) {
                  return false
                }

                // Check for duplicate (case-insensitive)
                const lower = trimmed.toLowerCase()
                if (seen.has(lower)) {
                  return false
                }
                seen.add(lower)
              }

              return true
            }
            return true
          },
          {
            message:
              'Enter categories as comma-separated values with no empty or duplicate entries.',
          },
        ),
    )
    .min(1, {
      message: 'Enter at least one response field',
    })
    .refine(
      (fields) => {
        const names = fields.map((f) => f.fieldName.toLowerCase())
        return new Set(names).size === names.length
      },
      {
        message: 'Field names must be unique (case-insensitive)',
      },
    ),
})
