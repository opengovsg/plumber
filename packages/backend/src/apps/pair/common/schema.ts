import z from 'zod/v3'

/**
 * Optional pipe id when linking a resource to a flow (must be a UUID when set).
 */
export const optionalFlowIdSchema = z.string().uuid().nullish()

export const outputFieldNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'Output name is required' })
  .max(64, {
    message: 'Output name cannot be more than 64 characters',
  })
  .regex(/^[a-zA-Z0-9 ]+$/, {
    message: 'Output name can only contain letters, numbers, and spaces',
  })

/** Spaces in UI-validated output names become underscores for storage / API keys. */
export function sanitizeOutputFieldName(name: string): string {
  return name.replace(/ /g, '_')
}

/** After `outputFieldNameSchema` parses, map to sanitized key + user-entered original. */
export function toSanitizedOutputFieldNamePair(validatedName: string): {
  fieldName: string
  originalFieldName: string
} {
  return {
    fieldName: sanitizeOutputFieldName(validatedName),
    originalFieldName: validatedName,
  }
}
