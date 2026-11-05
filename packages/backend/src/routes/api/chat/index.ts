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
import type { z } from 'zod'

import appConfig from '@/config/app'
import { GITBOOK_MCP_SERVER } from '@/config/flags'
import { BadUserInputError } from '@/errors/graphql-errors'
import { buildSupportFormUrl } from '@/helpers/ai/build-support-form-url'
import {
  closeQuietly,
  connectGitbookMcp,
  type GitbookMcpClient,
} from '@/helpers/ai/connect-gitbook-mcp'
import { getAiBuilderFlag } from '@/helpers/ai/get-ai-builder-flag'
import {
  AI_CHAT_GENERIC_ERROR_MESSAGE,
  getAiChatErrorMessage,
} from '@/helpers/ai/get-ai-chat-error-message'
import { getPrompt } from '@/helpers/ai/get-prompt'
import {
  parseWorkflowMetadata,
  WORKFLOW_METADATA_REGEX,
} from '@/helpers/ai/parse-workflow-metadata'
import { withAiTelemetryContext } from '@/helpers/ai/posthog-client'
import {
  repairMalformedStreamedToolNames,
  repairMalformedToolName,
} from '@/helpers/ai/repair-tool-call'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { createMcpBridgeTools } from '@/helpers/mcp-bridge-tools'
import { wrapMcpToolsWithUsageLogs } from '@/helpers/mcp-tool-usage-log'
import { model } from '@/helpers/pair'
import { pipeWebResponseToExpress } from '@/helpers/stream'
import Connection from '@/models/connection'
import { connectionLabel } from '@/services/mcp/list-connections'
import { AuthenticatedRequest } from '@/types/express/context'

import { buildChatSystemMessages } from './build-chat-system-messages'
import {
  createCacheBreakpointPreparer,
  sortToolsByName,
  sumCacheWriteInputTokens,
} from './cache-breakpoints'
import {
  establishPipeSubject,
  loadPipeForChatPreview,
  resolveEstablishedFormConnection,
  serializeMessagesForLangfuse,
  stripReasoningParts,
} from './helpers'
import { parseClarificationBlock } from './parse-clarification-block'
import { parseColumnTableBlock } from './parse-column-table-block'
import { parseDynamicPickerBlock } from './parse-dynamic-picker-block'
import { parseTileSetupBlock } from './parse-tile-setup-block'
import { chatRequestSchema } from './schema'
import { replaceSupportFormUrlPlaceholder } from './support-form-url-transform'

// Keep in sync with schema.ts and frontend/src/pages/AiBuilder/constants.ts.
const MAX_MESSAGES = 150
const MAX_STEPS_PER_TURN = 20

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

  const columnTable = parseColumnTableBlock(text)
  if (columnTable) {
    writer.write({
      type: 'data-columnTable',
      data: columnTable,
    })
  }

  const tileSetup = parseTileSetupBlock(text)
  if (tileSetup) {
    writer.write({
      type: 'data-tileSetup',
      data: tileSetup,
    })
  }
}

const handleChatStream = observe(
  async (
    req: AuthenticatedRequest,
    res: Response,
    body: z.infer<typeof chatRequestSchema>,
  ) => {
    const abortController = new AbortController()
    const context = req.context
    const allLdFlags = await getAllLdFlags(context.currentUser.email)
    const aiBuilderFlag = getAiBuilderFlag(allLdFlags)

    // NOTE: we pass restricted apps into the system prompt so the assistant knows which apps the user cannot use
    const restrictedApps = getRestrictedAppKeys(allLdFlags)

    const {
      chatPromptName,
      chatSummaryPromptName,
      version,
      disabledMcpServers,
    } = aiBuilderFlag.config
    const disabledMcpServerSet = new Set(disabledMcpServers)

    try {
      const { messages: rawMessages, chatId, ddRumSessionId, sessionId } = body

      // The RUM session id, preferring the new field but accepting the legacy
      // `sessionId` from clients deployed before the chatId change.
      const rumSessionId = ddRumSessionId || sessionId

      // Convert UIMessages to ModelMessages
      const messages = convertToModelMessages(
        stripReasoningParts(rawMessages) as Parameters<
          typeof convertToModelMessages
        >[0],
        { ignoreIncompleteToolCalls: true },
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
      // Mirrors the frontend's hasReachedLimit check exactly (same field, same
      // threshold) so both sides agree on which turn is the last one.
      const isAtLimit = rawMessages.length >= MAX_MESSAGES

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
        model: model.modelId,
        disabledMcpServers,
      })

      // Re-derived fresh every turn from the raw message text and verified
      // against this user's own connections — never trust the connectionId a
      // user references in their own chat text without checking ownership
      // first (see resolveEstablishedFormConnection).
      const establishedFormConnection = await resolveEstablishedFormConnection(
        context.currentUser,
        rawMessages,
      )
      const pipeSubject = await establishPipeSubject(
        context.currentUser,
        rawMessages,
      )

      const allMessages = [
        ...buildChatSystemMessages({
          basePrompt: prompt.prompt,
          restrictedApps,
          establishedFormConnection,
          pipeSubjectReminder: pipeSubject.reminder,
        }),
        ...messages,
      ]

      let mcpClient: GitbookMcpClient | null = null
      let gitbookTools = {} as Parameters<typeof streamText>[0]['tools']

      if (!disabledMcpServerSet.has(GITBOOK_MCP_SERVER)) {
        try {
          const gitbook = await connectGitbookMcp()
          mcpClient = gitbook.client
          gitbookTools = wrapMcpToolsWithUsageLogs(
            // oxlint-disable-next-line typescript/no-explicit-any
            gitbook.tools as Parameters<typeof streamText>[0]['tools'],
            {
              source: 'gitbook',
              traceId,
              userId: context.currentUser.email,
            },
          )
        } catch (error) {
          await mcpClient?.close()
          mcpClient = null
          logger.error('Failed to connect to GitBook MCP server', {
            traceId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const workflowError = 'Unable to generate the workflow.'

      let activePipeId: string | null = pipeSubject.seedPipeId
      let pipeToolRan = false

      // AI SDK 5 defaults onError to getErrorMessage, which forwards raw
      // litellm/provider dumps to the client. Override both stream constructors
      // so only UserFacingError (and a few mapped cases) reach the UI.
      const stream = createUIMessageStream({
        onError: getAiChatErrorMessage,
        execute: async ({ writer }) => {
          const mcpTools = createMcpBridgeTools(
            context.currentUser,
            traceId,
            (pipeId) => {
              activePipeId = pipeId
              pipeToolRan = true
            },
            (stepId, parameters, parameterLabels) => {
              writer.write({
                type: 'data-stepUpdate',
                data: { stepId, parameters, parameterLabels },
              })
            },
          )

          const result = withAiTelemetryContext(
            {
              distinctId: context.currentUser.id,
              aiSessionId: chatId || rumSessionId || 'unknown',
            },
            () =>
              streamText({
                model,
                messages: allMessages,
                tools: sortToolsByName({ ...gitbookTools, ...mcpTools }),
                stopWhen: stepCountIs(MAX_STEPS_PER_TURN),
                prepareStep: createCacheBreakpointPreparer(),
                experimental_repairToolCall: repairMalformedToolName,
                experimental_transform: [
                  repairMalformedStreamedToolNames,
                  replaceSupportFormUrlPlaceholder(buildSupportFormUrl(chatId)),
                  smoothStream({
                    chunking: 'word', // Stream word-by-word for typing effect
                  }),
                ],
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
                      steps: event.steps.length,
                      // IMPORTANT: key names avoid "token". Log redaction masks any key containing it.
                      inputUsage: event.totalUsage.inputTokens,
                      cacheReadUsage: event.totalUsage.cachedInputTokens,
                      cacheWriteUsage: sumCacheWriteInputTokens(event.steps),
                    })

                    updateActiveObservation({ output: event })
                    updateActiveTrace({ output: event })

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

                    // The client drops a proposal when pipe state rides in the same message.
                    const seedOnly = !pipeToolRan
                    if (activePipeId && !(seedOnly && hasWorkflowMetadata)) {
                      const flow = await loadPipeForChatPreview(
                        context.currentUser,
                        activePipeId,
                      )
                      // A viewer, a stranger, or a bad id gets no preview payload.
                      if (flow) {
                        const steps = await flow
                          .$relatedQuery('steps')
                          .orderBy('position', 'asc')

                        // Resolve connection labels fresh each turn. A step's
                        // connection can be repointed independently of the step row.
                        const connectionIds = [
                          ...new Set(
                            steps
                              .map((step) => step.connectionId)
                              .filter((id): id is string => !!id),
                          ),
                        ]
                        const connectionsById = connectionIds.length
                          ? new Map(
                              (
                                await Connection.query().findByIds(
                                  connectionIds,
                                )
                              ).map((connection) => [
                                connection.id,
                                connection,
                              ]),
                            )
                          : new Map<string, Connection>()

                        writer.write({
                          type: 'data-pipeState',
                          data: {
                            pipeId: activePipeId,
                            steps: steps.map((step) => {
                              const connection = step.connectionId
                                ? connectionsById.get(step.connectionId)
                                : undefined
                              return {
                                id: step.id,
                                appKey: step.appKey,
                                key: step.key,
                                type: step.type,
                                position: step.position,
                                status: step.status,
                                parameters: step.parameters,
                                connectionId: step.connectionId ?? null,
                                connectionLabel: connection
                                  ? connectionLabel(connection)
                                  : null,
                                // Lets the preview draw an If block's extent
                                // the same way the editor does.
                                endStepId: step.config?.endStepId ?? null,
                                // MRF stage steps are named after the form's stages.
                                stepName: step.config?.stepName ?? null,
                                // Lets the preview hide a reject path the same way
                                // the editor does.
                                approval: step.config?.approval ?? null,
                              }
                            }),
                          },
                        })
                      }
                    }

                    // Clarification blocks on both phases
                    emitTextAnnotations(event.text, writer)
                  } catch (error) {
                    logger.error('Error parsing workflow', {
                      traceId,
                      error:
                        error instanceof Error ? error.message : String(error),
                    })

                    writer.write({
                      type: 'data-isChatReady',
                      data: { isChatReady: false, error: workflowError },
                    })
                  } finally {
                    // IMPORTANT: awaiting close() holds the finished reply open while GitBook is unresponsive.
                    if (mcpClient) {
                      closeQuietly(mcpClient)
                    }

                    // Manually end the span since we're streaming
                    trace.getActiveSpan()?.end()
                  }
                },
                onError: ({ error }) => {
                  if (mcpClient) {
                    closeQuietly(mcpClient)
                  }
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
              }),
          )

          // Merge text stream into the response with metadata
          writer.merge(
            result.toUIMessageStream({
              onError: getAiChatErrorMessage,
              // finishReason 'tool-calls' means stopWhen cut the model off
              // mid-task. The UI uses it to offer Continue.
              messageMetadata: ({ part }) => ({
                traceId,
                model: model.modelId,
                ...(part.type === 'finish' && {
                  finishReason: part.finishReason,
                }),
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

      const errorMessage = getAiChatErrorMessage(error)

      // If headers haven't been sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({
          error: errorMessage || AI_CHAT_GENERIC_ERROR_MESSAGE,
        })
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

const router: Router = Router()

router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const validationResult = chatRequestSchema.safeParse(req.body)
  if (!validationResult.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: validationResult.error.issues,
    })
    return
  }

  return handleChatStream(req, res, validationResult.data)
})

export default router
