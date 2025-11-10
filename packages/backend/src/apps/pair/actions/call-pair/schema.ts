import z from 'zod/v3'

export const schema = z
  .object({
    promptType: z.enum([
      'analyse',
      'categorise',
      'summarise',
      'write',
      'custom',
    ]),
    prompt: z.string().min(1),
    responseFormat: z
      .enum(['singleField', 'multipleFields'])
      .default('singleField'),
    responseFields: z
      .array(
        z
          .object({
            fieldName: z
              .string()
              .min(1)
              .max(64)
              .regex(
                /^[a-zA-Z0-9_-]+$/,
                'Field name can only contain letters, numbers, underscores, and hyphens',
              ),
            fieldType: z.enum(['text', 'number', 'category']),
            fieldCategories: z.string().optional(),
          })
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
                // Validate comma-separated values
                // each value (after trimming) must not be empty
                const items = data.fieldCategories
                  .split(',')
                  .map((item: string) => item.trim())
                return items.every((item: string) => item.length > 0)
              }
              return true
            },
            {
              message:
                'Categories are required when field type is category. Enter comma-separated values',
            },
          ),
      )
      .optional()
      .default([]),
  })
  .refine(
    (data: {
      responseFormat?: 'singleField' | 'multipleFields'
      responseFields: {
        fieldName?: string
        fieldType?: 'number' | 'text' | 'category'
        fieldCategories?: string
      }[]
    }) => {
      if (data.responseFormat === 'multipleFields') {
        return data.responseFields && data.responseFields.length > 0
      }
      return true
    },
    {
      message:
        'Response fields must contain at least one field when response format is multiple fields',
      path: ['responseFields'],
    },
  )
