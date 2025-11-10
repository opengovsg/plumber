import { IGlobalVariable } from '@plumber/types'

import { startActiveObservation } from '@langfuse/tracing'
import { generateText as AiSdkGenerateText } from 'ai'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'

async function generateText(prompt: string, $: IGlobalVariable) {
  try {
    const result = await startActiveObservation(
      'pair-action-generate-text',
      async (trace) => {
        trace.updateTrace({
          userId: $.user.email,
          environment: appConfig.appEnv,
          tags: ['pair', 'action'],
        })

        trace.update({ input: prompt })

        const generation = trace.startObservation(
          'pair-action-generate-text',
          {
            model: MODEL_TYPE,
            input: [{ role: 'user', content: prompt as string }],
          },
          { asType: 'generation' },
        )

        const { text } = await AiSdkGenerateText({
          model,
          prompt: [{ role: 'user', content: prompt as string }],
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'pair-action-generate-text',
            metadata: {
              userId: $.user.email,
            },
          },
        })

        trace.update({ output: text })

        generation.update({ output: text }).end()

        return text
      },
    )

    return result
  } catch (error) {
    logger.error('Failed to generate text', {
      error: error,
      user: $.user.email,
    })
    throw error
  }
  return ''
}

export default generateText
