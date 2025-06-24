import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import { RelatedQueryBuilder } from 'objection'
import { z } from 'zod'

import StepError from '@/errors/step'
import ExecutionStep from '@/models/execution-step'

import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

import getDataOutMetadata from './get-data-out-metadata'
import getMockData from './get-mock-data'

const formsgTestRunMetadataSchema = z
  .object({
    preferMock: z.boolean().optional(),
  })
  .default({ preferMock: false })

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

  getDataOutMetadata,

  async testRun($: IGlobalVariable, testRunMetadata?: { preferMock: boolean }) {
    if (!$.auth.data) {
      throw new StepError(
        'Missing FormSG connection',
        'Click on choose connection and set up your form credentials.',
        $.step.position,
        $.app.name,
      )
    }

    const testRunMetadataRes =
      formsgTestRunMetadataSchema.safeParse(testRunMetadata)
    if (!testRunMetadataRes.success) {
      throw new StepError(
        'Something went wrong',
        'Invalid test run metadata. Please refresh and try again.',
        $.step.position,
        $.app.name,
      )
    }

    // data out should never be empty after test step is pressed once: either mock or actual data
    const { formId } = getFormDetailsFromGlobalVariable($)
    // We use last actual submission test execution step execution step
    const lastSubmittedTestExecutionStep = await $.getLastExecutionStep({
      testRunOnly: true,
      additionalFilter: (qb: RelatedQueryBuilder<ExecutionStep>) =>
        qb.andWhereRaw("(metadata->>'isMock')::boolean IS DISTINCT FROM true"),
    })

    const hasNoPastSubmission =
      !lastSubmittedTestExecutionStep ||
      lastSubmittedTestExecutionStep?.dataOut?.formId !== formId

    const shouldUseMockData =
      hasNoPastSubmission || testRunMetadataRes.data.preferMock

    // if test with mock data is selected OR no past submission exists
    // we use mock data
    const testData = shouldUseMockData
      ? await getMockData($)
      : lastSubmittedTestExecutionStep?.dataOut

    // if different or no form is detected, use mock data
    await $.pushTriggerItem({
      raw: testData,
      meta: {
        internalId: '',
      },
      isMock: shouldUseMockData,
    })
  },
}

export default trigger
