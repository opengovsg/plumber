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
