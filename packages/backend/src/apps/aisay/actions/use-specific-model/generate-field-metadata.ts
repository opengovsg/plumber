import { IDataOutMetadata, IJSONValue } from '@plumber/types'

export interface FieldValue {
  value: any
  label?: string
  order?: number
}

/**
 * NOTE: content is the raw extraction value
 * value can be a post proceed value depending on data type
 * e.g. date content "10 May 2025" value "2025-05-10"
 */
interface SubFieldMetadata {
  value: Record<string, FieldValue>
  content?: { label: string; type: string }
  confidence?: { label: string; type: string }
  value_type?: { label: string; type: string }
}

const DEFAULT_FIELD_PROPERTIES = {
  content: { label: 'Content', type: 'hidden' },
  confidence: { label: 'Confidence', type: 'hidden' },
  value_type: { label: 'Value Type', type: 'hidden' },
}

const splitByCapital = (str: string): string => {
  return str.split(/(?=[A-Z])/).join(' ')
}

export const createSubFieldMetadata = (
  field: string,
  subField: any,
  index: number,
): SubFieldMetadata => {
  const subFieldValues: Record<string, FieldValue> = {}

  Object.keys(subField.value).forEach((subFieldKey) => {
    subFieldValues[subFieldKey] = {
      value: {
        label: `${splitByCapital(field)} - ${index + 1}, ${splitByCapital(
          subFieldKey,
        )}`,
      },
      ...DEFAULT_FIELD_PROPERTIES,
    }
  })

  return {
    value: subFieldValues,
    ...DEFAULT_FIELD_PROPERTIES,
  }
}

export const createArrayFieldMetadata = (
  field: string,
  fieldValue: FieldValue,
) => {
  return {
    value: fieldValue.value.map((subField: any, index: number) =>
      createSubFieldMetadata(field, subField, index),
    ),
    ...DEFAULT_FIELD_PROPERTIES,
  }
}

export const createSimpleFieldMetadata = (field: string) => {
  return {
    value: {
      label: splitByCapital(field),
    },
    ...DEFAULT_FIELD_PROPERTIES,
  }
}

export const createObjectFieldMetadata = (
  field: string,
  fieldValue: FieldValue,
): SubFieldMetadata => {
  const subFieldValues: Record<string, FieldValue> = {}

  Object.keys(fieldValue).forEach((subFieldKey) => {
    subFieldValues[subFieldKey] = {
      value: {
        label: `${splitByCapital(field)} - ${splitByCapital(subFieldKey)}`,
      },
      ...DEFAULT_FIELD_PROPERTIES,
    }
  })

  return {
    value: subFieldValues,
    ...DEFAULT_FIELD_PROPERTIES,
  }
}

export const generateFieldMetadata = (fields: IJSONValue) => {
  const fieldsMetadata: Record<string, IDataOutMetadata> = {}

  Object.keys(fields).forEach((field) => {
    const fieldValue = (fields as unknown as Record<string, FieldValue>)[field]

    if (Array.isArray(fieldValue.value)) {
      fieldsMetadata[field] = createArrayFieldMetadata(field, fieldValue)
    } else if (fieldValue.value && typeof fieldValue.value === 'object') {
      fieldsMetadata[field] = createObjectFieldMetadata(field, fieldValue.value)
    } else {
      fieldsMetadata[field] = createSimpleFieldMetadata(field)
    }
  })
  return fieldsMetadata
}
