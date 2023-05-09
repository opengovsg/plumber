import { IGlobalVariable } from '@plumber/types'

import isEmpty from 'lodash/isEmpty'

import defineTrigger from '../../../../helpers/define-trigger'

export const NricFilter = {
  None: 'none',
  Remove: 'remove',
  Mask: 'mask',
  Hash: 'hash',
}

export default defineTrigger({
  name: 'New form submission',
  key: 'newSubmission',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request.',
  arguments: [
    {
      label: 'NRIC Filter',
      key: 'nricFilter',
      type: 'dropdown' as const,
      description: 'Choose how to handle NRIC numbers',
      required: false,
      variables: false,
      value: NricFilter.None,
      options: [
        {
          label: 'No nothing',
          value: NricFilter.None,
        },
        {
          label: 'Remove NRIC numbers',
          value: NricFilter.Remove,
        },
        {
          label: 'Mask NRIC numbers, e.g. S1234567A -> xxxxx567A',
          value: NricFilter.Mask,
        },
        {
          label:
            'Hash NRIC numbers, e.g. S1234567A -> 5f4dcc3b5aa765d61d8327deb882cf99',
          value: NricFilter.Hash,
        },
      ],
    },
  ],

  async testRun($: IGlobalVariable) {
    if (!isEmpty($.lastExecutionStep?.dataOut)) {
      await $.pushTriggerItem({
        raw: $.lastExecutionStep.dataOut,
        meta: {
          internalId: '',
        },
      })
    }
  },
})
