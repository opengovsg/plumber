import { z } from 'zod'

/**
 * Loose regex to just accept only alphanumeric characters and dashes
 * since there is no proper public documentation with GatherSG.
 * Assumption is that the case uuid is alphanumeric and 22 characters long.
 */
export const CASE_UUID_REGEX = /^[a-zA-Z0-9]{22}$/

export const UNSUPPORTED_FIELDS = [
  'table', // array of objects
  'attachment',
]

/**
 * GatherSG selection field types. UI labels match Ownself Gather:
 * Dropdown, Checkbox, Radio Button.
 */
export const GATHERSG_SELECTION_TYPES = [
  'dropdown',
  'checkbox',
  'radio',
] as const

export type GatherSGSelectionType = (typeof GATHERSG_SELECTION_TYPES)[number]

/**
 * Plumber fieldType values that send `string[]` to GatherSG.
 * Radio is excluded: Ownself Gather accepts a plain string for radio.
 * Includes legacy `list` so pipes saved before the type split keep working.
 */
export const LIST_LIKE_FIELD_TYPES = [
  'dropdown',
  'checkbox',
  'list',
] as const

export const fieldTypeEnum = z.enum([
  'string',
  'number',
  'null',
  'email',
  'dropdown',
  'checkbox',
  'radio',
  // Legacy alias for selection fields; kept for saved pipes.
  'list',
])

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
