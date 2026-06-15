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
