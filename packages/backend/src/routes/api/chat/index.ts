import {
  getActiveTraceId,
  observe,
  updateActiveObservation,
  updateActiveTrace,
} from '@langfuse/tracing'
import { trace } from '@opentelemetry/api'
import { convertToModelMessages, smoothStream, streamText } from 'ai'
import type { Response } from 'express'
import { Router } from 'express'

import appConfig from '@/config/app'
import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'
import { getPrompt } from '@/helpers/pair/get-prompt'
import { AuthenticatedRequest } from '@/types/express/context'

import { chatRequestSchema } from './schema'

const handleChatStream = observe(
  async (req: AuthenticatedRequest, res: Response) => {
    const context = req.context
    const aiBuilderFlag = await getLdFlagValue(
      AI_BUILDER_FEATURE_FLAG,
      context.currentUser.email,
      AI_BUILDER_FEATURE_FLAG_FALLBACK,
    )

    if (!aiBuilderFlag.enabled) {
      res
        .status(403)
        .json({ error: 'You do not have permissions to use AI Builder!' })
      return
    }

    const { chatPrompt, version } = aiBuilderFlag.config

    try {
      const validationResult = chatRequestSchema.safeParse(req.body)

      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: validationResult.error.errors,
        })
        return
      }

      const { messages: rawMessages, sessionId } = validationResult.data

      // Convert UIMessages to ModelMessages
      const messages = convertToModelMessages(
        rawMessages as Parameters<typeof convertToModelMessages>[0],
      )

      // Get the prompt from Langfuse
      const prompt = await getPrompt(chatPrompt, version)

      // Manually capture serializable input for Langfuse
      // joining with new line for readability on Langfuse
      updateActiveObservation({
        input: {
          messages: rawMessages.map((m) => ({
            role: m.role,
            content: m.parts
              .map((p) => {
                if (p.type === 'text') {
                  return p.text
                }
                return ''
              })
              .join('\n'),
          })),
        },
      })

      // Get the active trace ID from Langfuse context
      const traceId = getActiveTraceId() || ''

      logger.info('Starting AI chat stream', {
        traceId,
        sessionId,
        userId: context.currentUser.email,
        model: MODEL_TYPE,
      })

      const result = streamText({
        model,
        messages: [{ role: 'system', content: prompt.prompt }, ...messages],
        experimental_transform: smoothStream({
          chunking: 'word', // Stream word-by-word for typing effect
        }),
        experimental_telemetry: {
          isEnabled: true,
          metadata: {
            name: 'ai-chat-stream',
            sessionId: sessionId || 'unknown',
            userId: context.currentUser.email,
            environment: appConfig.appEnv,
            promptName: chatPrompt,
            promptVersion: version,
            langfusePrompt: prompt.toJSON(),
            tags: ['ai-builder', 'chat', 'stream'],
          },
        },
        onFinish: (event) => {
          logger.info('Stream finished', {
            traceId,
            textLength: event.text.length,
          })

          updateActiveObservation({ output: event })
          updateActiveTrace({ output: event })

          // Manually end the span since we're streaming
          trace.getActiveSpan()?.end()
        },
        onError: (error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          logger.error('Error generating chat response', {
            traceId,
            error: errorMessage,
          })

          updateActiveObservation({ output: errorMessage })
          updateActiveTrace({ output: errorMessage })

          // Manually end the span since we're streaming
          trace.getActiveSpan()?.end()
        },
      })

      // Pipe the UI message stream to Express response
      // This uses the data stream protocol that DefaultChatTransport expects
      result.pipeUIMessageStreamToResponse(res, {
        messageMetadata: () => {
          return {
            traceId,
            model: MODEL_TYPE,
          }
        },
      })
    } catch (error) {
      logger.error('Error in chat stream', { error })

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      // If headers haven't been sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({ error: errorMessage })
      } else {
        res.end()
      }
    }
  },
  {
    name: 'ai-chat-stream',
    asType: 'generation',
    /**
     * do not capture the input and output automatically as they will
     * throw an error about serializing the input and output
     */
    captureInput: false,
    captureOutput: false,
    /**
     * do not automatically end so that we can update the trace and observation
     * in the onFinish callback
     */
    endOnExit: false,
  },
)

const router = Router()

router.post('/', handleChatStream)

export default router
