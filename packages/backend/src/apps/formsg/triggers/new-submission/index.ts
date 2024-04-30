import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import StepError from '@/errors/step'

import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

import getDataOutMetadata from './get-data-out-metadata'
import getMockData from './get-mock-data'

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
    hideWebhookUrl: true,
    errorMsg:
      'Make a new submission to the form you connected and test the step again.',
    mockDataMsg:
      'The data below is mocked based on your form. Make a FormSG submission to modify the data.',
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
    if (!$.auth.data) {
      throw new StepError(
        'Missing FormSG connection',
        'Click on choose connection and set up your form credentials.',
        $.step.position,
        $.app.name,
      )
    }

    // data out should never be empty after test step is pressed once: either mock or actual data
    const { formId } = getFormDetailsFromGlobalVariable($)
    const lastExecutionStep = await $.getLastExecutionStep()

    // If no past submission (no form) or the form is changed, it is a mock run (pull mock data)
    const hasNoPastSubmission = lastExecutionStep?.dataOut?.formId !== formId

    // if different or no form is detected, use mock data
    await $.pushTriggerItem({
      raw: hasNoPastSubmission
        ? await getMockData($)
        : lastExecutionStep?.dataOut,
      meta: {
        internalId: '',
      },
      isMock:
        hasNoPastSubmission || (lastExecutionStep.metadata?.isMock ?? false), // use previous mock run status from metadata by default
    })
  },
}

export default trigger
