import { z } from 'zod'

import { CASE_UUID_REGEX } from '../../common/constants'

export const fieldTypeEnum = z.enum(['string', 'number', 'null'])

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
    caseStatus: z.string().trim().optional(),
    caseFields: z
      .array(
        z.object({
          field: z.string().trim().min(1, 'Field empty'),
          // we add nullish here because defaultValue or value doesnt work properly in dropdown
          fieldType: fieldTypeEnum.nullish(),
          value: z.string().trim().nullish(),
        }),
      )
      .transform((params, context) => {
        const result: Record<string, string | number | null> =
          Object.create(null)
        const seenFields = new Set<string>()
        for (const { field, fieldType, value } of params) {
          /**
           * No null fields are allowed
           * For now, we allow them to keep the field empty to set back to null. But in the future, may need to have a way to set to null vs set to empty string
           */
          if (!field) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Field empty',
            })
            return z.NEVER
          }

          // catch duplicate fields
          if (seenFields.has(field)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field} field is repeated`,
              fatal: true,
            })
            return z.NEVER
          }
          seenFields.add(field)

          // Right now, we will attempt to parse the value to the field type
          if (fieldType === 'null') {
            result[field] = null
          } else if (fieldType === 'number') {
            const parsedValue = Number(value)
            if (isNaN(parsedValue)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid number type for field: ${field}`,
              })
              return z.NEVER
            }
            result[field] = parsedValue
          } else {
            result[field] = value
          }
        }
        return result
      })
      .nullish(),
  })
  .transform((data) => ({
    caseUuid: data.caseUuid,
    ...(data.caseStatus && { status: data.caseStatus }),
    fields: data.caseFields,
  }))

// TODO: See if its possible to get more data from the response in the future if necessary
export const responseSchema = z.object({
  traceId: z.string(),
})
