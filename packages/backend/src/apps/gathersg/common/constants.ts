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

// GatherSG field types whose values should be treated as numbers. Every other
// supported field type (text, textarea, date, phone numbers, NRIC/UEN, etc.)
// is treated as a string, except GATHERSG_EMAIL_TYPES below.
export const GATHERSG_NUMBER_TYPES = ['number', 'money']

// GatherSG field types whose values should be validated as emails.
export const GATHERSG_EMAIL_TYPES = ['email']

// Prefix for hex encoding field names that contain special characters
export const HEX_ENCODED_FIELD_PREFIX = '__HEX_ENCODED__'
// Regex to match invalid characters in field names that need to be hex encoded
export const INVALID_CHAR_REGEX = /[^a-zA-Z0-9-_ ]/
