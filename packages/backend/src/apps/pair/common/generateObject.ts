import { IGlobalVariable } from '@plumber/types'

import { startActiveObservation } from '@langfuse/tracing'
import { generateObject as AiSdkGenerateObject } from 'ai'
import z from 'zod/v3'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'

async function generateObject(
  prompt: string,
  schema: z.ZodObject<any>,
  $: IGlobalVariable,
): Promise<any> {
  try {
    const result = await startActiveObservation(
      'pair-action-generate-object',
      async (trace) => {
        trace.updateTrace({
          userId: $.user.email,
          environment: appConfig.appEnv,
          tags: ['pair', 'action', 'generate-object'],
        })

        trace.update({ input: prompt })

        const generation = trace.startObservation(
          'pair-action-generate-object',
          {
            model: MODEL_TYPE,
            input: [{ role: 'user', content: prompt as string }],
          },
          { asType: 'generation' },
        )

        const { object } = await AiSdkGenerateObject({
          model,
          schema,
          system:
            "Based on the user's prompt, generate an object that adheres to the provided schema.",
          prompt,
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'pair-action-generate-object',
          },
        })

        trace.update({ output: object })

        generation.update({ output: object }).end()

        return object
      },
    )

    return result
  } catch (error) {
    logger.error('Failed to generate object', {
      error: error,
      user: $.user.email,
    })
    throw error
  }
}

export default generateObject
