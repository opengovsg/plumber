import { z } from 'zod'

/**
 * Very loose regex to just accept only alphanumeric characters and dashes
 * since there is no proper public documentation with M365
 */
const TABLE_ID_REGEX = /^\{[a-zA-Z0-9-]+\}$/ // this include start and end braces
const WORKSHEET_ID_REGEX = /^\{[a-zA-Z0-9-]+\}$/ // this include start and end braces
const FILE_ID_REGEX = /^[a-zA-Z0-9-]+$/
export const CELL_A1_ADDRESS_REGEX = /^[a-zA-Z]+[1-9][0-9]*$/

export const fileIdSchema = z
  .string()
  .trim()
  .regex(FILE_ID_REGEX, { message: 'Invalid file ID format.' })
  .min(1, { message: 'Please choose a file to lookup from.' })

export const tableIdSchema = z
  .string()
  .trim()
  .regex(TABLE_ID_REGEX, { message: 'Invalid table ID format.' })
  .min(1, { message: 'Please select a table to lookup from.' })

export const worksheetIdSchema = z
  .string()
  .trim()
  .regex(WORKSHEET_ID_REGEX, { message: 'Invalid worksheet ID format.' })
  .min(1, { message: 'Please select a worksheet to lookup from.' })

// Base schema object that can be extended by other actions (e.g., update-table-row)
export const baseLookupParametersSchema = z.object({
  fileId: fileIdSchema,
  tableId: tableIdSchema,
  // Old parameters - optional for backward compatibility
  lookupColumn: z
    .string()
    .min(1, {
      message: 'Please select a column to lookup from.',
    })
    .optional(),
  lookupValue: z.string().default('').optional(),
  // New parameters
  filters: z
    .array(
      z.object({
        lookupColumn: z.string().min(1),
        lookupValue: z.string().default(''),
      }),
    )
    .optional(),
})

/**
 * Helper to add lookup parameter validation refinement.
 * Ensures at least one format (old or new) is provided.
 */
export function withLookupValidation<T extends z.ZodObject<any>>(
  schema: T,
): z.ZodEffects<T, z.infer<T>, z.infer<T>> {
  return schema.refine(
    (data: z.infer<T>) => {
      // At least one format must be provided
      const hasOldFormat =
        'lookupColumn' in data && data.lookupColumn !== undefined
      const hasNewFormat =
        'filters' in data &&
        data.filters &&
        Array.isArray(data.filters) &&
        data.filters.length > 0
      return hasOldFormat || hasNewFormat
    },
    {
      message: 'Either lookup column/value or filters must be provided',
    },
  )
}

// Validated lookup parameters schema for actions that don't need to extend
export const lookupParametersSchema = withLookupValidation(
  baseLookupParametersSchema,
)
