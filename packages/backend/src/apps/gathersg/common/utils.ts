import { HEX_ENCODED_FIELD_PREFIX, INVALID_CHAR_REGEX } from './constants'

export function processFields(fields: Record<string, any>) {
  const processedFields: Record<string, any> = {}

  for (const [key, value] of Object.entries(fields)) {
    const hexKey = INVALID_CHAR_REGEX.test(key)
      ? `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(key).toString('hex')}`
      : key

    // Convert primitive arrays to objects for backward compatibility
    if (Array.isArray(value) && value.length > 0) {
      // Check if it's an array of primitives
      if (typeof value[0] !== 'object' || value[0] === null) {
        // Create an object with both individual elements and the full array
        const arrayObject: Record<string | number, any> = {}

        // Add individual array elements
        for (let i = 0; i < value.length; i++) {
          arrayObject[i] = value[i]
        }

        // Add the full array for the new type: 'array' field
        arrayObject._array = value

        processedFields[hexKey] = arrayObject
      } else {
        // Array of objects - keep as is
        processedFields[hexKey] = value
      }
    } else {
      // Not an array or empty array - keep as is
      processedFields[hexKey] = value
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
