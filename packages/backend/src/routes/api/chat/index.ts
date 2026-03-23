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
  stepCountIs,
  streamText,
  tool,
} from 'ai'
import type { Response } from 'express'
import { Router } from 'express'
import { z } from 'zod/v3'

import appConfig from '@/config/app'
import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
  APP_FLAG_REGEX,
} from '@/config/flags'
import { ACTIONS_SCHEMA } from '@/graphql/mutations/ai/schemas/actions.zod'
import { TRIGGER_SCHEMA } from '@/graphql/mutations/ai/schemas/triggers.zod'
import { buildSystemPrompt } from '@/helpers/build-system-prompt'
import { getAllLdFlags, getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'
import { getPrompt } from '@/helpers/pair/get-prompt'
import { pipeWebResponseToExpress } from '@/helpers/stream'
import { AuthenticatedRequest } from '@/types/express/context'

import { serializeMessagesForLangfuse } from './helpers'
import { chatRequestSchema } from './schema'

const MAX_MESSAGES = 50

const handleChatStream = observe(
  async (req: AuthenticatedRequest, res: Response) => {
    const abortController = new AbortController()
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

    // NOTE: we check LD for this user's access to apps
    // we then pass it into the system prompt to tell the assistant which apps the user does not have access to
    const allLdFlags = await getAllLdFlags(context.currentUser.email)
    const restrictedApps = Object.keys(allLdFlags)
      .filter((flag) => APP_FLAG_REGEX.test(flag) && allLdFlags[flag] === false)
      .map((flag) => flag.replace('app_', ''))

    const { chatPromptName, chatSummaryPromptName, version } =
      aiBuilderFlag.config

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

      // Manually capture serializable input for Langfuse
      updateActiveObservation({
        input: {
          messages: serializeMessagesForLangfuse(rawMessages),
        },
      })

      // Get the active trace ID from Langfuse context
      const traceId = getActiveTraceId() || ''

      // +1 for the system message
      const isAtLimit = messages.length + 1 >= MAX_MESSAGES

      // Get the prompt from Langfuse
      const prompt = await getPrompt(
        isAtLimit ? chatSummaryPromptName : chatPromptName,
        version,
      )

      logger.info('Starting AI chat stream', {
        traceId,
        sessionId,
        userId: context.currentUser.email,
        model: MODEL_TYPE,
      })

      const systemMessage = {
        role: 'system' as const,
        content: buildSystemPrompt(prompt.prompt, restrictedApps),
      }
      const allMessages = [systemMessage, ...messages]

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          const result = streamText({
            model,
            messages: allMessages,
            tools: {
              generateWorkflow: tool({
                name: 'generateWorkflow',
                description:
                  'Generate a structured workflow with a trigger and actions. ALWAYS call this tool whenever the workflows steps are generated (basically whenever the HTML table exists).',
                inputSchema: z.object({
                  name: z.string().max(64).default('Build with AI'),
                  trigger: TRIGGER_SCHEMA,
                  actions: ACTIONS_SCHEMA,
                }),
                execute: async ({ name, trigger, actions }) => {
                  console.log('TOOL CALLED')
                  console.log('output', name, trigger, actions)
                  return { name, trigger, actions }
                },
              }),
            },
            stopWhen: stepCountIs(3),
            experimental_transform: smoothStream({
              chunking: 'word',
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
                tags: [
                  'ai-builder',
                  'stream',
                  isAtLimit ? 'chat-summary' : 'chat',
                ],
              },
            },
            abortSignal: abortController.signal,
            onFinish: async (event) => {
              try {
                logger.info('Stream finished', {
                  traceId,
                  textLength: event.text.length,
                })

                updateActiveObservation({ output: event })
                updateActiveTrace({ output: event })
              } catch (error) {
                logger.error('Error in stream onFinish', {
                  traceId,
                  error: error instanceof Error ? error.message : String(error),
                })
              } finally {
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
