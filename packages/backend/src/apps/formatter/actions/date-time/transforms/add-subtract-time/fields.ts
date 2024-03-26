import { type DurationLikeObject } from 'luxon'
import z from 'zod'

import { type TransformSpec } from '@/apps/formatter/common/transform-spec'

export const fieldSchema = z
  .object({
    addSubtractTimeOps: z
      .array(
        z.object({
          opType: z.enum(['add', 'subtract']),
          timeUnit: z.enum([
            'seconds',
            'minutes',
            'hours',
            'days',
            'months',
            // To simplify date math code, values have the same keys as luxton
            // duration objects.
          ] as const satisfies ReadonlyArray<keyof DurationLikeObject>),
          timeAmount: z
            .string()
            .transform((amount) => Number(amount))
            .pipe(z.number().int().positive()),
        }),
      )
      .min(1),
  })
  .transform((params) => ({
    ops: params.addSubtractTimeOps,
  }))

// FIXME: Some jank zod-fu here as I am trying to prevent duplicating data across
// zod schema + IFields[]. :/
const subFieldsSchema =
  fieldSchema.sourceType().shape.addSubtractTimeOps.element

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const fields: TransformSpec['fields'] = [
  {
    label: 'Specify the amount of time you want to add or subtract',
    key: fieldSchema.sourceType().keyof().enum.addSubtractTimeOps,
    type: 'multirow' as const,
    required: true,
    subFields: [
      {
        placeholder: 'Add or subtract?',
        key: subFieldsSchema.keyof().enum.opType,
        type: 'dropdown' as const,
        required: true,
        variables: false,
        showOptionValue: false,
        options: subFieldsSchema.shape.opType.options.map((opName) => ({
          label: sentenceCase(opName),
          value: opName,
        })),
      },
      {
        placeholder: 'Amount of time to add or subtract (number)',
        key: subFieldsSchema.keyof().enum.timeAmount,
        type: 'string' as const,
        required: true,
        variables: true,
      },
      {
        placeholder: 'Unit of time to add or subtract',
        key: subFieldsSchema.keyof().enum.timeUnit,
        type: 'dropdown' as const,
        required: true,
        variables: false,
        showOptionValue: false,
        options: subFieldsSchema.shape.timeUnit.options.map((unit) => ({
          label: sentenceCase(unit),
          value: unit,
        })),
      },
    ],
  },
]
