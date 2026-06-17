import { z } from 'zod'

import { MAX_LOOKUP_CONDITIONS } from './constants'

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

export const filtersSchema = z
  .array(
    z.object({
      // Populated by dynamic data, so no need to trim.
      lookupColumn: z.string().min(1),
      // * We don't trim as we want to match _exactly_ on the user's input.
      // * We allow empty strings to support optional form fields.
      lookupValue: z.string().default(''),
    }),
  )
  .min(1, { message: 'Please add at least one lookup condition.' })
  .max(MAX_LOOKUP_CONDITIONS, {
    message: `You can only add up to ${MAX_LOOKUP_CONDITIONS} lookup conditions.`,
  })
  .refine(
    (filters) => {
      const columns = filters.map((f) => f.lookupColumn)
      return new Set(columns).size === columns.length
    },
    {
      message: 'Each lookup condition must use a different column.',
    },
  )

export const lookupParametersSchema = z.object({
  fileId: fileIdSchema,
  tableId: tableIdSchema,
  filters: filtersSchema,
})
