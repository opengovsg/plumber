import { type DurationLikeObject } from 'luxon'
import z from 'zod'

import { type TransformSpec } from '@/apps/formatter/common/transform-spec'
import { ensureZodObjectKey } from '@/helpers/zod-utils'

const opTypeEnum = z.enum(['add', 'subtract'])

const timeUnitEnum = z.enum([
  'seconds',
  'minutes',
  'hours',
  'days',
  'months',
  // To simplify date math code, values have the same keys as luxton
  // duration objects.
] as const satisfies ReadonlyArray<keyof DurationLikeObject>)

const opsSchema = z.object({
  opType: opTypeEnum,
  timeUnit: timeUnitEnum,
  timeAmount: z
    .string({
      required_error: 'No value found',
    })
    .trim()
    .min(1, { message: 'No value found' })
    .transform((amount) => Number(amount))
    .pipe(
      z
        .number({ invalid_type_error: 'Enter a whole number' })
        .int('Enter whole numbers without decimals'),
    ),
})

export const fieldSchema = z
  .object({
    addSubtractDateTimeOps: z.array(opsSchema).min(1),
  })
  .transform((params) => ({
    ops: params.addSubtractDateTimeOps,
  }))

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const fields: TransformSpec['fields'] = [
  {
    label: 'Specify the amount of time you want to add or subtract',
    key: ensureZodObjectKey(fieldSchema.sourceType(), 'addSubtractDateTimeOps'),
    type: 'multirow' as const,
    required: true,
    subFields: [
      {
        placeholder: 'Add or subtract?',
        key: ensureZodObjectKey(opsSchema, 'opType'),
        type: 'dropdown' as const,
        required: true,
        variables: false,
        showOptionValue: false,
        options: opTypeEnum.options.map((op) => ({
          label: sentenceCase(op),
          value: op,
        })),
      },
      {
        placeholder: 'Amount of time to add or subtract (number)',
        key: ensureZodObjectKey(opsSchema, 'timeAmount'),
        type: 'string' as const,
        required: true,
        variables: true,
      },
      {
        placeholder: 'Unit of time to add or subtract',
        key: ensureZodObjectKey(opsSchema, 'timeUnit'),
        type: 'dropdown' as const,
        required: true,
        variables: false,
        showOptionValue: false,
        options: timeUnitEnum.options.map((unit) => ({
          label: sentenceCase(unit),
          value: unit,
        })),
      },
    ],
  },
]
