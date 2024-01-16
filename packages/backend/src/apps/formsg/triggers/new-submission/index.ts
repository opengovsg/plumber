import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import isEmpty from 'lodash/isEmpty'

import getDataOutMetadata from './get-data-out-metadata'

export const NricFilter = {
  None: 'none',
  Remove: 'remove',
  Mask: 'mask',
  Hash: 'hash',
}

const trigger: IRawTrigger = {
  name: 'New form submission',
  key: 'newSubmission',
  type: 'webhook',
  description: 'Triggers when a new form submission is received',
  webhookTriggerInstructions: {
    beforeUrlMsg: `# Make a new submission to the form you connected. Then, click test step.`,
    hideWebhookUrl: true,
    errorMsg:
      'Make a new submission to the form you connected and test the step again.',
  },
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
          label: 'Do nothing',
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

  getDataOutMetadata,

  async testRun($: IGlobalVariable) {
    const lastExecutionStep = await $.getLastExecutionStep()
    if (!isEmpty(lastExecutionStep?.dataOut)) {
      await $.pushTriggerItem({
        raw: lastExecutionStep?.dataOut,
        meta: {
          internalId: '',
        },
      })
    }
  },
}

export default trigger
