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
  type UIMessageStreamWriter,
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
import { createMcpBridgeTools } from '@/helpers/mcp-bridge-tools'
import { model, MODEL_TYPE } from '@/helpers/pair'
import { pipeWebResponseToExpress } from '@/helpers/stream'
import Flow from '@/models/flow'
import { AuthenticatedRequest } from '@/types/express/context'

import { serializeMessagesForLangfuse } from './helpers'
import { parseClarificationBlock } from './parse-clarification-block'
import { parseDynamicPickerBlock } from './parse-dynamic-picker-block'
import { chatRequestSchema } from './schema'

const MAX_MESSAGES = 50

function emitTextAnnotations(text: string, writer: UIMessageStreamWriter) {
  const questions = parseClarificationBlock(text)
  if (questions) {
    writer.write({
      type: 'data-clarification',
      data: { questions },
    })
  }

  const dynamicPicker = parseDynamicPickerBlock(text)
  if (dynamicPicker) {
    writer.write({
      type: 'data-dynamicPicker',
      data: dynamicPicker,
    })
  }
}

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

      const {
        messages: rawMessages,
        chatId,
        ddRumSessionId,
        sessionId,
      } = validationResult.data

      // The RUM session id, preferring the new field but accepting the legacy
      // `sessionId` from clients deployed before the chatId change.
      const rumSessionId = ddRumSessionId || sessionId

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

      // Use rawMessages (UIMessage count from the client) rather than the expanded
      // ModelMessages array. convertToModelMessages inflates the count because each
      // tool call round-trip becomes separate assistant + tool_result model messages,
      // which would trigger summary mode far too early on tool-heavy conversations.
      // +1 accounts for the system message added below.
      const isAtLimit = rawMessages.length + 1 >= MAX_MESSAGES

      // Get the prompt from Langfuse
      const prompt = await getPrompt(
        isAtLimit ? chatSummaryPromptName : chatPromptName,
        'aiBuilder',
        version,
      )

      logger.info('Starting AI chat stream', {
        traceId,
        chatId,
        ddRumSessionId: rumSessionId,
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
        mcpClient = null
        logger.error('Failed to connect to GitBook MCP server', {
          traceId,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      let workflowError = 'Unable to generate the workflow.'

      let activePipeId: string | null = null

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          const mcpTools = createMcpBridgeTools(
            context.currentUser,
            traceId,
            (pipeId) => {
              activePipeId = pipeId
            },
            (stepId, parameters, parameterLabels) => {
              writer.write({
                type: 'data-stepUpdate',
                data: { stepId, parameters, parameterLabels },
              })
            },
          )

          const result = streamText({
            model,
            messages: allMessages,
            tools: { ...gitbookTools, ...mcpTools },
            stopWhen: stepCountIs(10),
            experimental_transform: smoothStream({
              chunking: 'word', // Stream word-by-word for typing effect
            }),
            experimental_telemetry: {
              isEnabled: true,
              functionId: 'ai-chat-stream',
              metadata: {
                name: 'ai-chat-stream',
                // Langfuse session = the chat session. Falls back to the RUM id for
                // old clients during rollout, then 'unknown'. The fallbacks are
                // removed in the cleanup release once old clients have drained.
                sessionId: chatId || rumSessionId || 'unknown',
                // Plain metadata (non-special key) so RUM traces can still be
                // correlated with Langfuse without driving session grouping.
                ddRumSessionId: rumSessionId || undefined,
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

                const mcpStepConfig =
                  aiBuilderFlag.config.mcpStepConfig ?? false

                if (mcpStepConfig) {
                  // Phase 2a: LLM proposed a workflow (WORKFLOW_METADATA present, no tools ran)
                  const hasWorkflowMetadata = WORKFLOW_METADATA_REGEX.test(
                    event.text,
                  )
                  if (hasWorkflowMetadata) {
                    try {
                      const parsedWorkflowMetadata = parseWorkflowMetadata(
                        event.text,
                        restrictedApps,
                      )
                      const flowSteps = { ...parsedWorkflowMetadata, traceId }
                      writer.write({
                        type: 'data-isChatReady',
                        data: { isChatReady: true, flowSteps, mcpMode: true },
                      })
                    } catch (error) {
                      const msg =
                        error instanceof BadUserInputError
                          ? error.message
                          : 'Unable to generate the workflow.'
                      writer.write({
                        type: 'data-isChatReady',
                        data: {
                          isChatReady: true,
                          error: msg,
                          mcpMode: true,
                        },
                      })
                    }
                  }

                  // Phase 2b+: MCP tools ran this turn — emit fresh pipe state from DB
                  if (activePipeId) {
                    const flow = await Flow.query()
                      .findById(activePipeId)
                      .where('user_id', context.currentUser.id)
                    const steps = flow
                      ? await flow
                          .$relatedQuery('steps')
                          .orderBy('position', 'asc')
                      : []

                    writer.write({
                      type: 'data-pipeState',
                      data: {
                        pipeId: activePipeId,
                        steps: steps.map((step) => ({
                          id: step.id,
                          appKey: step.appKey,
                          key: step.key,
                          type: step.type,
                          position: step.position,
                          status: step.status,
                          parameters: step.parameters,
                          connectionId: step.connectionId ?? null,
                        })),
                      },
                    })
                  }

                  // Clarification blocks on both phases
                  emitTextAnnotations(event.text, writer)
                } else {
                  // Old YAML path — unchanged
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
                    emitTextAnnotations(event.text, writer)
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
                try {
                  await mcpClient?.close()
                } catch (closeError) {
                  logger.warn('Failed to close GitBook MCP client', {
                    traceId,
                    error:
                      closeError instanceof Error
                        ? closeError.message
                        : String(closeError),
                  })
                }

                // Manually end the span since we're streaming
                trace.getActiveSpan()?.end()
              }
            },
            onError: (error) => {
              void mcpClient?.close()
              mcpClient = null
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
