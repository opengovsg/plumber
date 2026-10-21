import z from 'zod'

import {
  outputFieldNameSchema,
  toSanitizedOutputFieldNamePair,
} from '../../common/schema'

const TOTAL_DESCRIPTION_LENGTH_LIMIT = 10_000

export function hasProvidedImage(image: string[] | undefined): boolean {
  return Array.isArray(image) && image.some((id) => id.trim() !== '')
}

export const schema = z
  .object({
    continueIfNoFile: z.boolean().default(false),
    // NOTE: this is an array because the attachment field returns an array
    image: z.array(z.string()).max(1, { message: 'Only one image allowed' }),
    responseFields: z
      .array(
        z
          .object({
            fieldName: outputFieldNameSchema,

            description: z
              .string()
              .min(1, { message: 'Description is required' }),
          })
          .transform((field) => ({
            ...toSanitizedOutputFieldNamePair(field.fieldName),
            description: field.description,
          })),
      )
      .min(1, { message: 'At least one response field is required' })
      .refine(
        (fields) => {
          // After transformation, check uniqueness of sanitized field names
          const names = fields.map((f) => f.fieldName.toLowerCase())
          return new Set(names).size === names.length
        },
        {
          message: 'Output names must be unique (case-insensitive)',
        },
      )
      .refine(
        (fields) => {
          const totalLength = fields.reduce(
            (sum, field) => sum + field.description.length,
            0,
          )
          return totalLength <= TOTAL_DESCRIPTION_LENGTH_LIMIT
        },
        {
          message: `Total length of all descriptions cannot exceed ${TOTAL_DESCRIPTION_LENGTH_LIMIT} characters`,
        },
      ),
  })
  .superRefine((data, ctx) => {
    if (!hasProvidedImage(data.image) && !data.continueIfNoFile) {
      ctx.addIssue({
        code: 'custom',
        message: 'An image must be selected',
        path: ['image'],
      })
    }
  })
