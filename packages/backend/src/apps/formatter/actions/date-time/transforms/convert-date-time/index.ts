import type { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import { firstZodParseError } from '@/helpers/zod-utils'

import type { TransformSpec } from '../../../../common/transform-spec'
import {
  fieldSchema as dateTimeFormatSchema,
  parseDateTime,
} from '../../common/date-time-format'

import { field, fieldSchema } from './fields'

// Helper function to provide a nice StepError
function getParams($: IGlobalVariable) /* inferred return type */ {
  try {
    const { dateTimeFormat } = dateTimeFormatSchema.parse($.step.parameters)
    const { formatDateTimeToFormat: formatString } = fieldSchema.parse(
      $.step.parameters,
    )
    return { dateTimeFormat, formatString }
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

export const spec = {
  id: 'formatDateTime',

  dropdownConfig: {
    label: 'Format',
    description: 'Change a date or time to a new format style',
  },

  fields: [field],

  transformData: async ($, valueToTransform) => {
    try {
      const { dateTimeFormat, formatString } = getParams($)
      const dateTime = parseDateTime(dateTimeFormat, valueToTransform)

      $.setActionItem({
        raw: {
          result: dateTime.toFormat(formatString),
        },
      })
    } catch (error) {
      if (error instanceof StepError) {
        throw error
      }

      throw new StepError(
        `Error with the original value: '${error.message}'`,
        'Ensure that you have selected the correct date format for your original value.',
        $.step.position,
        $.app.name,
      )
    }
  },
} satisfies TransformSpec
