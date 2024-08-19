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
  name: 'New form response',
  key: 'newSubmission',
  type: 'webhook',
  description: 'This workflow starts when a new form response is received',
  webhookTriggerInstructions: {
    hideWebhookUrl: true,
    errorMsg:
      'Make a new submission to the form you connected and test the step again.',
    mockDataMsg: 'The mock responses below are based on your form fields.',
  },
  arguments: [
    {
      label: 'NRIC Filter',
      key: 'nricFilter',
      type: 'dropdown' as const,
      description: 'Choose how to handle NRIC/FINs',
      required: false,
      variables: false,
      value: NricFilter.None,
      options: [
        {
          label: 'Do nothing',
          value: NricFilter.None,
        },
        {
          label: 'Remove NRICs',
          value: NricFilter.Remove,
        },
        {
          label: 'Mask NRICs, e.g. S1234567A → xxxxx567A',
          value: NricFilter.Mask,
        },
        {
          label:
            'Hash NRICs, e.g. S1234567A → 5f4dcc3b5aa765d61d8327deb882cf99',
          value: NricFilter.Hash,
        },
      ],
      showOptionValue: false,
    },
  ],
  // TODO (mal): change form link to correct one
  helpMessage:
    'Connect your form to this step. If you don’t have one, here is a [sample](https://go.gov.sg/request-template).',

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
    // We use last test execution step
    const lastTestExecutionStep = await $.getLastExecutionStep({
      testRunOnly: true,
    })
    // If no past submission (no form) or the form is changed, it is a mock run (re-pull mock data)
    const hasNoPastSubmission =
      lastTestExecutionStep?.dataOut?.formId !== formId ||
      lastTestExecutionStep.metadata.isMock

    // if different or no form is detected, use mock data
    await $.pushTriggerItem({
      raw: hasNoPastSubmission
        ? await getMockData($)
        : lastTestExecutionStep?.dataOut,
      meta: {
        internalId: '',
      },
      isMock:
        hasNoPastSubmission ||
        (lastTestExecutionStep.metadata?.isMock ?? false), // use previous mock run status from metadata by default
    })
  },
}

export default trigger
