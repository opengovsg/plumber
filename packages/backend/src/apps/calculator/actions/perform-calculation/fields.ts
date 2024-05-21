import type { IRawAction } from '@plumber/types'

import { capitalize } from 'lodash'
import z from 'zod'

import { ensureZodObjectKey } from '@/helpers/zod-utils'

import { numericStringSchema } from '../../common/numeric-string-schema'

const opTypeEnum = z.enum(['add', 'subtract', 'multiply', 'divide'])

export const fieldSchema = z.object({
  firstNumber: numericStringSchema,
  op: opTypeEnum,
  secondNumber: numericStringSchema,
})

export const fields = [
  {
    label: 'Number to transform',
    key: ensureZodObjectKey(fieldSchema, 'firstNumber'),
    type: 'string' as const,
    required: true,
    variables: true,
  },
  {
    label: 'Math operation to perform',
    key: ensureZodObjectKey(fieldSchema, 'op'),
    type: 'dropdown' as const,
    required: true,
    variables: false,
    showOptionValue: false,
    options: opTypeEnum.options.map((op) => ({
      label: capitalize(op),
      value: op,
    })),
  },
  {
    placeholder: 'Value',
    key: ensureZodObjectKey(fieldSchema, 'secondNumber'),
    type: 'string' as const,
    required: true,
    variables: true,
  },
] satisfies IRawAction['arguments']
