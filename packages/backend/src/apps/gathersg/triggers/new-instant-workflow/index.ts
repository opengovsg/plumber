import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import { type SafeParseError, type ZodIssue } from 'zod'

import StepError from '@/errors/step'

import getDataOutMetadata from './get-data-out-metadata'
import { encryptionKeySchema } from './schema'

const trigger: IRawTrigger = {
  name: 'New instant workflow',
  key: 'newInstantWorkflow',
  type: 'webhook',
  noAuthRequired: true,
  description:
    'Executes this Pipe when an instant workflow is triggered from Ownself Gather',
  webhookTriggerInstructions: {
    beforeUrlMsg: `# 1. Configure your instant workflow using this webhook URL.`,
    afterUrlMsg: `# 2. Trigger the instant workflow. Then, click check step.`,
  },
  arguments: [
    {
      label: 'Encryption key',
      key: 'encryptionKey',
      type: 'string' as const,
      description:
        'Enter the encryption key for your instant workflow and save it.',
      required: false,
      variables: false,
      // Secret-like value; not something the AI Builder should ask about.
      hiddenFromAiIf: {
        op: 'always_true',
      },
    },
  ],

  getDataOutMetadata,

  async testRun($: IGlobalVariable) {
    const { encryptionKey } = $.step.parameters
    if (encryptionKey) {
      const validation = encryptionKeySchema.safeParse(encryptionKey)

      if (!validation.success) {
        const { issues } = (validation as SafeParseError<string>).error
        // combine all possible errors with the encryption key
        const error = issues
          .map((e: ZodIssue) => e.message)
          .filter(Boolean)
          .join(', ')

        throw new StepError(
          'Encryption key is not valid',
          `Encryption key must ${error}`,
        )
      }
    }

    const lastExecutionStep = await $.getLastExecutionStep({
      testRunOnly: true,
    })
    await $.pushTriggerItem({
      raw: lastExecutionStep?.dataOut ?? {},
      meta: {
        internalId: '',
      },
    })
  },
}

export default trigger
