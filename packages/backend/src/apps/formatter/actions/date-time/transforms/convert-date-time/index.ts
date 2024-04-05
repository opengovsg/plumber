import type { TransformSpec } from '../../../../common/transform-spec'
import {
  fieldSchema as dateTimeFormatSchema,
  parseDateTime,
} from '../../common/date-time-format'

import { field, fieldSchema } from './fields'

export const spec = {
  id: 'formatDateTime',

  dropdownConfig: {
    label: 'Format',
    description: 'Change a date or time to a new format style',
  },

  fields: [field],

  transformData: async ($, valueToTransform) => {
    const { dateTimeFormat } = dateTimeFormatSchema.parse($.step.parameters)
    const { formatDateTimeToFormat: formatString } = fieldSchema.parse(
      $.step.parameters,
    )

    const dateTime = parseDateTime(dateTimeFormat, valueToTransform)
    $.setActionItem({ raw: { result: dateTime.toFormat(formatString) } })
  },
} satisfies TransformSpec
