import { IFlowSteps } from '@plumber/types'

import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
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
} from 'ai'
import type { Response } from 'express'
import { Router } from 'express'

import appConfig from '@/config/app'
import { BadUserInputError } from '@/errors/graphql-errors'
import { getAiBuilderFlag } from '@/helpers/ai/get-ai-builder-flag'
import { getPrompt } from '@/helpers/ai/get-prompt'
import {
  parseWorkflowMetadata,
  WORKFLOW_METADATA_REGEX,
} from '@/helpers/ai/parse-workflow-metadata'
import { buildSystemPrompt } from '@/helpers/build-system-prompt'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'
import { pipeWebResponseToExpress } from '@/helpers/stream'
import { AuthenticatedRequest } from '@/types/express/context'

import { serializeMessagesForLangfuse } from './helpers'
import { parseClarificationBlock } from './parse-clarification-block'
import { chatRequestSchema } from './schema'

const MAX_MESSAGES = 50

const handleChatStream = observe(
  async (req: AuthenticatedRequest, res: Response) => {
    const abortController = new AbortController()
    const context = req.context
    const allLdFlags = await getAllLdFlags(context.currentUser.email)
    const aiBuilderFlag = getAiBuilderFlag(allLdFlags)

    if (!aiBuilderFlag.enabled) {
      res
        .status(403)
        .json({ error: 'You do not have permissions to use AI Builder!' })
      return
    }

    // NOTE: we pass restricted apps into the system prompt so the assistant knows which apps the user cannot use
    const restrictedApps = getRestrictedAppKeys(allLdFlags)

    const { chatPromptName, chatSummaryPromptName, version } =
      aiBuilderFlag.config

    try {
      const validationResult = chatRequestSchema.safeParse(req.body)

      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: validationResult.error.issues,
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
        'aiBuilder',
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

      let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null
      let gitbookTools = {} as Parameters<typeof streamText>[0]['tools']

      try {
        mcpClient = await createMCPClient({
          transport: {
            type: 'http',
            url: 'https://guide.plumber.gov.sg/~gitbook/mcp',
          },
        })
        gitbookTools =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (await mcpClient.tools()) as Parameters<typeof streamText>[0]['tools']
      } catch (error) {
        await mcpClient?.close()
        logger.error('Failed to connect to GitBook MCP server', {
          traceId,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      let workflowError = 'Unable to generate the workflow.'

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          const result = streamText({
            model,
            messages: allMessages,
            tools: gitbookTools,
            stopWhen: stepCountIs(5),
            experimental_transform: smoothStream({
              chunking: 'word', // Stream word-by-word for typing effect
            }),
            experimental_telemetry: {
              isEnabled: true,
              functionId: 'ai-chat-stream',
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
                await mcpClient?.close()
                logger.info('Stream finished', {
                  traceId,
                  textLength: event.text.length,
                })

                updateActiveObservation({ output: event })
                updateActiveTrace({ output: event })

                const hasWorkflowMetadata = WORKFLOW_METADATA_REGEX.test(
                  event.text,
                )

                let flowSteps: IFlowSteps | undefined = undefined

                if (hasWorkflowMetadata) {
                  try {
                    const parsedWorkflowMetadata = parseWorkflowMetadata(
                      event.text,
                      restrictedApps,
                    )
                    flowSteps = { ...parsedWorkflowMetadata, traceId }
                  } catch (error) {
                    workflowError =
                      error instanceof BadUserInputError
                        ? error.message
                        : 'Unable to generate the workflow.'
                  }
                }

                // isChatReady: true whenever WORKFLOW_METADATA is present (success or error)
                // isChatReady: false only when there is no WORKFLOW_METADATA block
                // NOTE: type MUST start with "data-" - SDK enforces this
                writer.write({
                  type: 'data-isChatReady',
                  data: {
                    isChatReady: hasWorkflowMetadata,
                    ...(hasWorkflowMetadata &&
                      (flowSteps ? { flowSteps } : { error: workflowError })),
                  },
                })

                if (!hasWorkflowMetadata) {
                  const questions = parseClarificationBlock(event.text)
                  if (questions) {
                    writer.write({
                      type: 'data-clarification',
                      data: { questions },
                    })
                  }
                }
              } catch (error) {
                logger.error('Error parsing workflow', {
                  traceId,
                  error: error instanceof Error ? error.message : String(error),
                })

                writer.write({
                  type: 'data-isChatReady',
                  data: { isChatReady: false, error: workflowError },
                })
              } finally {
                // Manually end the span since we're streaming
                trace.getActiveSpan()?.end()
              }
            },
            onError: (error) => {
              void mcpClient?.close()
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
