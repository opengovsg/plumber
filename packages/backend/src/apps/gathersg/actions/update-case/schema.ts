import { z } from 'zod'

export const requestSchema = z
  .object({
    caseId: z.string().trim().min(1, {
      message: 'Please do not leave the case id empty',
    }),
    caseStatus: z.string().trim().min(1, {
      message: 'Please do not leave the case status empty',
    }),
    caseFields: z
      .array(
        z.object({
          field: z.string().trim().min(1, 'Field empty').nullish(),
          value: z.string().trim().nullish(),
        }),
      )
      .transform((params, context) => {
        const result: Record<string, string | number | null> =
          Object.create(null)
        const seenFields = new Set<string>()
        for (const { field, value } of params) {
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

          // Right now, we don't know the field type so if it could be a number, we will just set it to a number
          if (value === '') {
            result[field] = null
          } else if (!isNaN(Number(value))) {
            result[field] = Number(value)
          } else {
            result[field] = value
          }
        }
        return result
      })
      .nullish(),
  })
  .transform((data) => ({
    caseId: data.caseId,
    status: data.caseStatus,
    fields: data.caseFields,
  }))

// TODO: See if its possible to get more data from the response in the future if necessary
export const responseSchema = z.object({
  traceId: z.string(),
})
