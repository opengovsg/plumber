import type { IRawAction } from '@plumber/types'

import { fixedFieldsSchema } from '../../common/fixed-fields'
import { setUpActionFields } from '../../common/set-up-action-fields'

const action: IRawAction = {
  name: 'Date / Time',
  key: 'dateTime',
  description: 'Format date and time values',
  arguments: setUpActionFields({
    commonFields: [],
    transforms: [
      // Example for now - see later PR for actual transforms.
      {
        id: 'exampleTransform',
        dropdownConfig: {
          label: 'An example transform',
        },
        fields: [
          {
            label: 'Example input',
            key: 'exampleTransformInput',
            type: 'string' as const,
            required: true,
            variables: true,
          },
        ],
        transformData: () => {
          return
        },
      },
    ],
  }),

  async run($) {
    //
    // Stub example for now - see later PR for actual implementation
    //

    const { transformId, valueToTransform } = fixedFieldsSchema.parse(
      $.step.parameters,
    )

    $.setActionItem({
      raw: {
        selectedTransform: transformId,
        valueToTransform,
      },
    })
  },
}

export default action
