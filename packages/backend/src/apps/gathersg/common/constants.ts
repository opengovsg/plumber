import { z } from 'zod'

/**
 * Loose regex to just accept only alphanumeric characters and dashes
 * since there is no proper public documentation with GatherSG.
 * Assumption is that the case uuid is alphanumeric and 22 characters long.
 */
export const CASE_UUID_REGEX = /^[a-zA-Z0-9]{22}$/

export const UNSUPPORTED_FIELDS = [
  'dropdown', // array of strings
  'checkbox', // array of strings
  'table', // array of objects
  'attachment',
]

export const fieldTypeEnum = z.enum(['string', 'number', 'null', 'email'])

// Prefix for hex encoding field names that contain special characters
export const HEX_ENCODED_FIELD_PREFIX = '__HEX_ENCODED__'
// Regex to match invalid characters in field names that need to be hex encoded
export const INVALID_CHAR_REGEX = /[^a-zA-Z0-9-_ ]/
