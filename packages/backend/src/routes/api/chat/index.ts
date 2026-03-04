import {
  getActiveTraceId,
  observe,
  updateActiveObservation,
  updateActiveTrace,
} from '@langfuse/tracing'
import { trace } from '@opentelemetry/api'
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
} from 'ai'
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
import { pipeWebResponseToExpress } from '@/helpers/stream'
import { AuthenticatedRequest } from '@/types/express/context'

import { getChatReadiness } from './get-chat-readiness'
import { serializeMessagesForLangfuse } from './helpers'
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

    const {
      chatPromptName,
      chatReadinessPromptName,
      chatReadinessModel,
      version,
    } = aiBuilderFlag.config

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
      const prompt = await getPrompt(chatPromptName, version)

      // Manually capture serializable input for Langfuse
      updateActiveObservation({
        input: {
          messages: serializeMessagesForLangfuse(rawMessages),
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

      const systemMessage = { role: 'system' as const, content: prompt.prompt }
      const allMessages = [systemMessage, ...messages]

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          const result = streamText({
            model,
            messages: allMessages,
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
                promptName: chatPromptName,
                promptVersion: version,
                langfusePrompt: prompt.toJSON(),
                tags: ['ai-builder', 'chat', 'stream'],
              },
            },
            onFinish: async (event) => {
              try {
                logger.info('Stream finished', {
                  traceId,
                  textLength: event.text.length,
                })

                updateActiveObservation({ output: event })
                updateActiveTrace({ output: event })

                // Check if chat is ready for step generation using a fast structured call
                const isChatReady = await getChatReadiness({
                  context,
                  promptName: chatReadinessPromptName,
                  promptVersion: version,
                  llmResponse: event.text,
                  sessionId: sessionId || '',
                  modelId: chatReadinessModel,
                })

                // Write chat readiness status as a data annotation
                // NOTE: type MUST start with "data-" - SDK enforces this
                writer.write({
                  type: 'data-isChatReady',
                  data: { isChatReady },
                })
              } catch (error) {
                logger.error('Error checking chat readiness', {
                  traceId,
                  error: error instanceof Error ? error.message : String(error),
                })

                // Write fallback isReady: false to ensure client receives a response
                writer.write({
                  type: 'data-isChatReady',
                  data: { isReady: false },
                })
              } finally {
                // Manually end the span since we're streaming
                trace.getActiveSpan()?.end()
              }
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

          // Merge text stream into the response with metadata
          writer.merge(
            result.toUIMessageStream({
              messageMetadata: () => ({
                traceId,
                model: MODEL_TYPE,
              }),
            }),
          )
        },
      })

      // Create a proper HTTP Response from the stream
      const webResponse = createUIMessageStreamResponse({ stream })

      // Pipe the web response to Express
      await pipeWebResponseToExpress(webResponse, res)
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
