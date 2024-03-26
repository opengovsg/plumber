import type { IField } from '@plumber/types'

import z from 'zod'

import type { TransformSpec } from './transform-spec'

export const fixedFieldsSchema = z.object({
  transformId: z.string(),
  valueToTransform: z.string(),
})

export const SELECT_TRANSFORM_DROPDOWN_FIELD_KEY =
  fixedFieldsSchema.keyof().enum.transformId
export const VALUE_TO_TRANSFORM_FIELD_KEY =
  fixedFieldsSchema.keyof().enum.valueToTransform

export const VALUE_TO_TRANSFORM_FIELD: IField = {
  label: 'Value to transform',
  key: VALUE_TO_TRANSFORM_FIELD_KEY,
  type: 'string' as const,
  required: true,
  variables: true,
  hiddenIf: {
    fieldKey: SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
    op: 'is_empty',
    fieldValue: '',
  },
}

export function createSelectTransformDropdown(
  transforms: TransformSpec[],
): IField {
  return {
    label: 'How do you want to transform your data?',
    key: SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
    type: 'dropdown' as const,
    required: true,
    variables: false,
    showOptionValue: false,
    options: transforms.map((t) => ({
      ...t.dropdownConfig,
      value: t.id,
    })),
  }
}
