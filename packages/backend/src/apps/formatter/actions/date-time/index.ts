import type { IRawAction } from '@plumber/types'

import { fixedFieldsSchema } from '../../common/fixed-fields'
import { setUpActionFields } from '../../common/set-up-action-fields'

import { field as dateFormatField } from './common/date-time-format'
import { spec as addSubtractDateTime } from './transforms/add-subtract-date-time'

const action: IRawAction = {
  name: 'Date / Time',
  key: 'dateTime',
  description: 'Format date and time values',
  arguments: setUpActionFields({
    commonFields: [dateFormatField],
    transforms: [addSubtractDateTime],
  }),

  async run($) {
    const { transformId, valueToTransform } = fixedFieldsSchema.parse(
      $.step.parameters,
    )

    switch (transformId) {
      case addSubtractDateTime.id:
        return await addSubtractDateTime.transformData($, valueToTransform)
      default:
        throw new Error(`Unknown Date/Time transform: '${transformId}'`)
    }
  },
}

export default action
