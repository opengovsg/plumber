import { HEX_ENCODED_FIELD_PREFIX, INVALID_CHAR_REGEX } from './constants'

export function processFields(fields: Record<string, any>) {
  const processedFields: Record<string, any> = {}

  for (const [key, value] of Object.entries(fields)) {
    if (INVALID_CHAR_REGEX.test(key)) {
      const hexKey = `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(key).toString(
        'hex',
      )}`
      processedFields[hexKey] = value
    } else {
      processedFields[key] = value
    }
  }
  return processedFields
}

export function decodeFieldName(key: string): string {
  // decode hex encoded field name to get the original field name
  let decodedLabel: string
  if (key.startsWith(HEX_ENCODED_FIELD_PREFIX)) {
    decodedLabel = Buffer.from(
      key.replace(HEX_ENCODED_FIELD_PREFIX, ''),
      'hex',
    ).toString('utf-8')
  } else {
    decodedLabel = key
  }
  return decodedLabel
}
