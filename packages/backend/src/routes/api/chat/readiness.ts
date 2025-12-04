import { startActiveObservation } from '@langfuse/tracing'
import { generateObject } from 'ai'
import type { Request, Response } from 'express'
import { Router } from 'express'
import z from 'zod/v3'

import appConfig from '@/config/app'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'
import { getPrompt } from '@/helpers/pair/get-prompt'

import { getAuthenticatedContext } from '../middleware/authentication'

interface ChatReadinessRequest {
  message: string
  sessionId: string
}

const handleChatReadiness = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const context = getAuthenticatedContext(req)

  try {
    const { message: rawMessage } = req.body as ChatReadinessRequest

    const promptConfig = await getLdFlagValue(
      'ai-builder-prompt-config',
      context.currentUser.email,
      {
        chatReadinessPrompt: 'chat-readiness-check',
        version: 'production',
      },
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

    res.json({ isReady: result.isReady })
  } catch (error) {
    logger.error('Error in chat readiness', { error })
    res.status(500).json({ error: 'Internal server error' })
  }
}

const router = Router()

router.post('/', handleChatReadiness)

export default router
