import { IJSONArray } from '@plumber/types'

import { HEX_ENCODED_FIELD_PREFIX } from './constants'

// Helper function to decode hex-encoded field keys
export function decodeFieldKey(key: string): string {
  try {
    if (key.startsWith(HEX_ENCODED_FIELD_PREFIX)) {
      const hexPart = key.replace(HEX_ENCODED_FIELD_PREFIX, '')
      const decodedLabel = Buffer.from(hexPart, 'hex').toString('utf-8')

      // If decoding produces empty string, it means the hex was invalid
      // Fall back to using the original key
      if (decodedLabel === '') {
        return key
      }

      return decodedLabel
    }
    return key
  } catch {
    return key
  }
}

// Helper function to check if an array contains only attachment keys
export function isAttachmentKeyArray(
  array: any[],
  attachmentKeys: string[],
): boolean {
  // Empty arrays should not be treated as attachment arrays
  if (array.length === 0) {
    return false
  }
  return array.every(
    (item) => typeof item === 'string' && attachmentKeys.includes(item),
  )
}

// Helper function to create metadata for direct arrays
export function createArrayMetadata(
  decodedLabel: string,
  fieldValue: any[],
  attachmentKeys: string[],
): Record<string, any> | any[] {
  // Handle empty arrays first
  if (fieldValue.length === 0) {
    return []
  }

  // Check for object array
  if (typeof fieldValue[0] === 'object' && fieldValue[0] !== null) {
    return createObjectArrayMetadata(decodedLabel, fieldValue as IJSONArray)
  }

  // Handle primitive array - check for attachments
  if (isAttachmentKeyArray(fieldValue, attachmentKeys)) {
    return { label: decodedLabel, isHidden: true }
  }

  // Create indexed elements
  return fieldValue.map((_, index) => ({
    type: 'text',
    label: `${decodedLabel} ${index + 1}`,
  }))
}

// Helper function to create metadata for a single field
export function createFieldMetadata(
  key: string,
  fieldValue: any,
  attachmentKeys: string[],
): Record<string, any> | any[] {
  const decodedLabel = decodeFieldKey(key)

  // Handle converted primitive array (has _array property)
  if (
    typeof fieldValue === 'object' &&
    fieldValue !== null &&
    !Array.isArray(fieldValue) &&
    '_array' in fieldValue
  ) {
    return createPrimitiveArrayMetadata(
      decodedLabel,
      fieldValue._array as any[],
      attachmentKeys,
    )
  }

  // Handle array
  if (Array.isArray(fieldValue)) {
    return createArrayMetadata(decodedLabel, fieldValue, attachmentKeys)
  }

  // Simple field
  return { label: decodedLabel }
}

// Helper function to create metadata for object arrays
export function createObjectArrayMetadata(
  decodedLabel: string,
  array: IJSONArray,
): Record<string, any> {
  const rowsMetadata: Record<string, any> = {}

  for (let i = 0; i < array.length; i++) {
    const rowObject = array[i]
    const rowMetadata: Record<string, any> = {}

    if (typeof rowObject === 'object' && rowObject !== null) {
      for (const nestedKey of Object.keys(rowObject)) {
        rowMetadata[nestedKey] = {
          type: 'text',
          label: `${decodedLabel} Row ${i + 1} ${nestedKey}`,
        }
      }
    }

    rowsMetadata[i] = rowMetadata
  }

  return rowsMetadata
}

// Helper function to create metadata for optional nested objects
export function createOptionalNestedMetadata<T extends Record<string, any>>(
  data: T | null | undefined,
  fieldLabels: Record<keyof T, string>,
): Record<string, { label: string }> | { isHidden: true } {
  if (!data) {
    return { isHidden: true }
  }

  const metadata: Record<string, { label: string }> = {}
  for (const [key, label] of Object.entries(fieldLabels)) {
    metadata[key] = { label }
  }
  return metadata
}

// Helper function to create metadata for primitive arrays (with _array property)
export function createPrimitiveArrayMetadata(
  decodedLabel: string,
  array: any[],
  attachmentKeys: string[],
): Record<string, any> {
  // Handle attachment key arrays
  if (isAttachmentKeyArray(array, attachmentKeys)) {
    return { label: decodedLabel, isHidden: true }
  }

  // Create individual elements + _array field
  const arrayElements: Record<string, any> = {}
  for (let i = 0; i < array.length; i++) {
    arrayElements[i] = {
      type: 'text',
      label: decodedLabel,
    }
  }

  return {
    ...arrayElements,
    _array: {
      label: decodedLabel,
      type: 'array',
      displayedValue: array.join(', '),
    },
  }
}
