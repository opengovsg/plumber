import { z } from 'zod'

import { fieldTypeEnum } from './constants'

const caseFieldSchema = z.object({
  field: z.string().trim().min(1, 'Field empty'),
  // we add nullish here because defaultValue or value doesnt work properly in dropdown
  fieldType: fieldTypeEnum.nullish(),
  value: z.string().trim().nullish(),
})

// `fieldType` is widened to `string` (rather than reused verbatim from
// `caseFieldSchema`'s inferred literal union) so this switch can already
// branch on field types not yet present in `fieldTypeEnum`.
type CaseField = Omit<z.infer<typeof caseFieldSchema>, 'fieldType'> & {
  fieldType?: string | null
}

const transformCaseFields = (params: CaseField[], context: z.RefinementCtx) => {
  const result: Record<string, string | number | null> = Object.create(null)
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
    } else if (fieldType === 'email') {
      const emailResult = z.string().trim().email().safeParse(value)
      if (!emailResult.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid email for field: ${field}`,
        })
        return z.NEVER
      }
      result[field] = emailResult.data
    } else {
      result[field] = value
    }
  }
  return result
}

/**
 * Shared `caseFields` array schema for create-case/update-case, parsing the
 * multirow-multicol `{ field, fieldType, value }` rows into a
 * `Record<string, string | number | null>` payload. A missing/null
 * `fieldType` is treated the same as `'string'` by `transformCaseFields`'s
 * fallback branch, so no default is needed here.
 */
export const caseFieldsSchema = z
  .array(caseFieldSchema)
  .transform(transformCaseFields)
