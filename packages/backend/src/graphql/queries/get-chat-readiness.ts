import { startActiveObservation } from '@langfuse/tracing'
import { generateObject } from 'ai'
import z from 'zod/v3'

import appConfig from '@/config/app'
import {
  AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG,
  AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'
import { getPrompt } from '@/helpers/pair/get-prompt'

import type { QueryResolvers } from '../__generated__/types.generated'

const getChatReadiness: QueryResolvers['getChatReadiness'] = async (
  _parent,
  params,
  context,
) => {
  try {
    const { message: rawMessage, sessionId } = params

    const promptConfig = await getLdFlagValue(
      AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG,
      context.currentUser.email,
      AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG_FALLBACK,
    )
    const { chatReadinessPrompt, version } = promptConfig
    const prompt = await getPrompt(chatReadinessPrompt, version)
    const { prompt: systemPrompt } = prompt

    const result = await startActiveObservation(
      'chat-readiness',
      async (trace) => {
        trace.updateTrace({
          userId: context.currentUser.email,
          environment: appConfig.appEnv,
          tags: ['ai-builder', 'is-chat-ready'],
          sessionId,
        })

        trace.update({
          input: {
            message: rawMessage,
          },
        })

        const generation = trace.startObservation(
          'is-chat-ready',
          {
            model: MODEL_TYPE,
            input: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: rawMessage },
            ],
          },
          { asType: 'generation' },
        )

        generation.update({ prompt })

        const { object } = await generateObject({
          model,
          schema: z.object({
            isReady: z.boolean(),
          }),
          system: systemPrompt,
          prompt: rawMessage,
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'is-chat-ready',
          },
        })

        trace.update({ output: object })

        generation.update({ output: object }).end()

        return object
      },
    )

    return { isReady: result.isReady }
  } catch (error) {
    logger.error('Error in getChatReadiness', { error })
    throw new Error('Error encountered. Please try again.')
  }
}

export default getChatReadiness
