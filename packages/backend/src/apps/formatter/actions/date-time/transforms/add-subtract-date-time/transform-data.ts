import type { IGlobalVariable } from '@plumber/types'
import { DateTime, type DurationLikeObject } from 'luxon'
import z, { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'
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

    throw new StepError({
      name: `Configuration problem: '${firstZodParseError(error)}'`,
      solution: GenericSolution.ReconfigureInvalidField,
      kind: 'config',
    })
  }
}

function parseValue(
  dateTimeFormat: z.infer<typeof dateTimeFormatSchema>['dateTimeFormat'],
  valueToTransform: string,
): DateTime {
  try {
    return parseDateTime(dateTimeFormat, valueToTransform)
  } catch (error) {
    throw new StepError({
      name: `Error processing dates: '${error.message}'`,
      solution:
        'Ensure that you have selected the correct date format, and that time periods to add / subtract are valid numbers.',
      kind: 'config',
    })
  }
}

export const transformData: TransformSpec['transformData'] = async (
  $,
  valueToTransform,
) => {
  try {
    const { dateTimeFormat, ops } = getParams($)
    const valueAsDateTime = parseValue(dateTimeFormat, valueToTransform)
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

    logger.error('Add / subtract date time failed after parsing the value', {
      event: 'formatter-add-subtract-date-time-failed',
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      flowId: $.flow?.id,
      stepId: $.step?.id,
      executionId: $.execution?.id,
    })
    throw new StepError({
      name: `Error processing dates: '${error.message}'`,
      solution:
        'There was an unexpected problem. Please contact plumber@open.gov.sg for assistance.',
      kind: 'internal',
    })
  }
}
