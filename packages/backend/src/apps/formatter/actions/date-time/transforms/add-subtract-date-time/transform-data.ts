import { DateTime, type DurationLikeObject } from 'luxon'
import z from 'zod'

import type { TransformSpec } from '../../../../common/transform-spec'
import {
  dateTimeToString,
  fieldSchema as dateTimeFormatSchema,
  parseDateTime,
} from '../../common/date-time-format'

import { fieldSchema } from './fields'

// NOTE: We always use calendar math
// https://moment.github.io/luxon/#/math?id=calendar-math-vs-time-math
function performDateMath(
  value: DateTime,
  ops: z.infer<typeof fieldSchema>['ops'],
): DateTime {
  let result = value

  // We always perform operations one-by-one, in user-specified order.
  // This is to avoid scenarios like
  // https://moment.github.io/luxon/#/math?id=math-with-multiple-units.
  for (const op of ops) {
    // op.timeUnit is designed to have same name as luxton's Duration keys.
    const duration = {
      [op.timeUnit]: op.timeAmount,
    } satisfies DurationLikeObject

    switch (op.opType) {
      case 'add':
        result = result.plus(duration)
        break
      case 'subtract':
        result = result.minus(duration)
        break
    }
  }

  return result
}

export const transformData: TransformSpec['transformData'] = async (
  $,
  valueToTransform,
) => {
  const { dateTimeFormat } = dateTimeFormatSchema.parse($.step.parameters)
  const { ops } = fieldSchema.parse($.step.parameters)

  const valueAsDateTime = parseDateTime(dateTimeFormat, valueToTransform)
  const result = performDateMath(valueAsDateTime, ops)

  $.setActionItem({
    raw: {
      result: dateTimeToString(dateTimeFormat, result),
    },
  })
}
