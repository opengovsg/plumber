import type { IRawAction } from '@plumber/types'

import z from 'zod'

import { ensureZodEnumValue, ensureZodObjectKey } from '@/helpers/zod-utils'

import { numericStringSchema } from '../../common/numeric-string-schema'

const opTypeEnum = z.enum(['roundDown', 'roundUp', 'roundOff'])

export const fieldSchema = z.object({
  value: numericStringSchema,
  op: opTypeEnum,
  toDecimalPlaces: numericStringSchema.pipe(
    z
      .number()
      .int('Enter whole numbers without decimals')
      .nonnegative('Enter a number greater than 0'),
  ),
})

export const fields = [
  {
    label: 'Number to round',
    key: ensureZodObjectKey(fieldSchema, 'value'),
    type: 'string' as const,
    required: true,
    variables: true,
  },
  {
    label: 'Rounding',
    key: ensureZodObjectKey(fieldSchema, 'op'),
    type: 'dropdown' as const,
    required: true,
    variables: false,
    showOptionValue: false,
    options: [
      {
        label: 'Round Down',
        value: ensureZodEnumValue(opTypeEnum, 'roundDown'),
      },
      {
        label: 'Round Up',
        value: ensureZodEnumValue(opTypeEnum, 'roundUp'),
      },
      {
        label: 'Round Off',
        value: ensureZodEnumValue(opTypeEnum, 'roundOff'),
      },
    ],
  },
  {
    label: 'Decimal places',
    key: ensureZodObjectKey(fieldSchema, 'toDecimalPlaces'),
    type: 'string' as const,
    required: true,
    variables: true,
  },
] satisfies IRawAction['arguments']
