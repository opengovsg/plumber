import { z } from 'zod'

import { fieldTypeEnum, LIST_LIKE_FIELD_TYPES } from './constants'

const caseFieldSchema = z.object({
  field: z.string().trim().min(1, 'Field empty'),
  // we add nullish here because defaultValue or value doesnt work properly in dropdown
  fieldType: fieldTypeEnum.nullish(),
  // string for scalar fields; string[] after compute-parameters resolves a
  // FormSG checkbox into a list field
  value: z.union([z.string().trim(), z.array(z.string())]).nullish(),
})

// `fieldType` is widened to `string` (rather than reused verbatim from
// `caseFieldSchema`'s inferred literal union) so this switch can already
// branch on field types not yet present in `fieldTypeEnum`.
type CaseField = Omit<z.infer<typeof caseFieldSchema>, 'fieldType'> & {
  fieldType?: string | null
}

const toStringArray = (
  field: string,
  value: string | string[] | null | undefined,
  context: z.RefinementCtx,
): string[] | typeof z.NEVER => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `List value empty for field: ${field}`,
      })
      return z.NEVER
    }
    return value.map((item) => String(item))
  }

  if (typeof value === 'string' && value.length > 0) {
    // FormSG dropdown answers arrive as a single string
    return [value]
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `Invalid list value for field: ${field}. Select a FormSG checkbox, dropdown, or radio button.`,
  })
  return z.NEVER
}

const transformCaseFields = (params: CaseField[], context: z.RefinementCtx) => {
  const result: Record<string, string | number | null | string[]> =
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
    } else if (
      fieldType != null &&
      (LIST_LIKE_FIELD_TYPES as readonly string[]).includes(fieldType)
    ) {
      const listValue = toStringArray(field, value, context)
      if (listValue === z.NEVER) {
        return z.NEVER
      }
      result[field] = listValue
    } else {
      result[field] = typeof value === 'string' ? value : value?.join(', ')
    }
  }
  return result
}

/**
 * Shared `caseFields` array schema for create-case/update-case, parsing the
 * multirow-multicol `{ field, fieldType, value }` rows into a
 * `Record<string, string | number | null | string[]>` payload. A missing/null
 * `fieldType` is treated the same as `'string'` by `transformCaseFields`'s
 * fallback branch, so no default is needed here.
 */
export const caseFieldsSchema = z
  .array(caseFieldSchema)
  .transform(transformCaseFields)
