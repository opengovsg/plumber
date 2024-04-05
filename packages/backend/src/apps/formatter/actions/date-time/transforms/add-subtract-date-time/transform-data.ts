import type { IGlobalVariable } from '@plumber/types'

import { DateTime, type DurationLikeObject } from 'luxon'
import z, { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import { firstZodParseError } from '@/helpers/zod-utils'

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
    // op.timeUnit is designed to have same name as luxon's Duration keys.
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

// Helper function to provide a nice StepError
function getParams($: IGlobalVariable) /* inferred return type */ {
  try {
    const { dateTimeFormat } = dateTimeFormatSchema.parse($.step.parameters)
    const { ops } = fieldSchema.parse($.step.parameters)
    return { dateTimeFormat, ops }
  } catch (error) {
    if (!(error instanceof ZodError)) {
      throw error
    }

    throw new StepError(
      `Configuration problem: '${firstZodParseError(error)}'`,
      GenericSolution.ReconfigureInvalidField,
      $.step.position,
      $.app.name,
    )
  }
}

export const transformData: TransformSpec['transformData'] = async (
  $,
  valueToTransform,
) => {
  try {
    const { dateTimeFormat, ops } = getParams($)
    const valueAsDateTime = parseDateTime(dateTimeFormat, valueToTransform)
    const result = performDateMath(valueAsDateTime, ops)

    $.setActionItem({
      raw: {
        result: dateTimeToString(dateTimeFormat, result),
      },
    })
  } catch (error) {
    if (error instanceof StepError) {
      throw error
    }

    throw new StepError(
      `Error processing dates: '${error.message}'`,
      'Ensure that you have selected the correct date format, and that time periods to add / subtract are valid numbers.',
      $.step.position,
      $.app.name,
    )
  }
}
