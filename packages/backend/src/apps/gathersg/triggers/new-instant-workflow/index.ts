import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import { type SafeParseError, type ZodIssue } from 'zod'

import StepError from '@/errors/step'

import { encryptionKeySchema } from './schema'

const trigger: IRawTrigger = {
  name: 'New instant workflow',
  key: 'newInstantWorkflow',
  type: 'webhook',
  description:
    'Executes this Pipe when an instant workflow is triggered from GatherSG',
  webhookTriggerInstructions: {
    beforeUrlMsg: `# 1. Configure your instant workflow using this webhook URL.`,
    afterUrlMsg: `# 2. Make an update to your case. Then, click check step.`,
  },
  arguments: [
    {
      label: 'Encryption key',
      key: 'encryptionKey',
      type: 'string' as const,
      description:
        'Enter the encryption key for your instant workflow. It must be 12-20 characters long and include at least one number, one uppercase letter, and one special character (e.g., %, $, #).',
      required: false,
      variables: false,
    },
  ],

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
          $.step.position,
          $.app.name,
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
