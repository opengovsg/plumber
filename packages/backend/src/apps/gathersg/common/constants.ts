import { z } from 'zod'

/**
 * Gather case ids are 22 alphanumeric characters.
 * They are not RFC 4122 UUIDs (36 hex characters with hyphens).
 * They are not ULIDs (26 Crockford base32 characters).
 */
export const CASE_UUID_REGEX = /^[a-zA-Z0-9]{22}$/

/**
 * Ownself Gather case refs are a date plus a 5-digit running number.
 * Example: 261007-00001.
 */
export const CASE_REF_REGEX = /^\d{6}-\d{5}$/

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
 */
export const LIST_LIKE_FIELD_TYPES = ['dropdown', 'checkbox'] as const

export const fieldTypeEnum = z.enum([
  'string',
  'number',
  'null',
  'email',
  'dropdown',
  'checkbox',
  'radio',
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

/**
 * The Ownself Gather File API lives on a different base (file-api) than the CMS
 * API and uses Bearer-token auth, so attachment uploads cannot go through the
 * app's $.http client (which is pinned to the CMS base + x-api-key).
 */
export const GATHER_FILE_API_UPLOAD_URL =
  'https://gather.gov.sg/file/api/upload'

/**
 * Ownself Gather case-field type for attachment fields. Sent as the `type` in
 * the upload-token request body.
 */
export const GATHER_ATTACHMENT_FIELD_TYPE = 'attachment'
