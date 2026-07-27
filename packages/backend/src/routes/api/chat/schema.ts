import { z } from 'zod/v4'

import { flowStepsSchema } from '@/helpers/ai/types'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Limits to protect API and LLM costs
const MAX_MESSAGES = 50
const MAX_TEXT_LENGTH = 10000 // characters per message part (~2,500 tokens)
// Tool-use turns can produce many parts (step-start + tool-invocation per call + text),
// so allow enough headroom for up to ~10 tool calls per assistant turn.
const MAX_PARTS_PER_MESSAGE = 50

// Tool invocation part shape — shared by all MCP bridge tool entries below.
// The backend does not process these parts; it only needs to accept them when
// the AI SDK echoes the full assistant message back on subsequent turns.
const toolPart = <T extends string>(toolType: T) =>
  z.object({
    type: z.literal(toolType),
    toolCallId: z.string().optional(),
    toolName: z.string().optional(),
    state: z.string().optional(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
  })

const messagePartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z
      .string()
      .trim()
      // No .min(1) here. When the LLM uses a tool, the AI SDK opens each
      // generation step with a text part before emitting the tool call. If the
      // model goes straight to calling a tool without generating any preamble,
      // that part lands as text: "". The frontend echoes the full assistant
      // message back on subsequent turns, so we must accept empty strings or
      // every multi-step tool-use conversation breaks on the second turn.
      .max(MAX_TEXT_LENGTH, `Text cannot exceed ${MAX_TEXT_LENGTH} characters`),
  }),
  z.object({
    type: z.literal('step-start'),
  }),
  z.object({
    type: z.literal('data-isChatReady'),
    data: z.union([
      z.object({ isChatReady: z.boolean(), flowSteps: flowStepsSchema }),
      z.object({ isChatReady: z.boolean(), error: z.string() }),
      // TODO (kevinkim-ogp): remove this in the next release
      // Legacy format from clients before this deploy — can be removed after one release cycle
      z.object({ isChatReady: z.boolean() }),
    ]),
  }),
  z.object({
    type: z.literal('data-clarification'),
    data: z.object({
      questions: z
        .array(
          z.object({
            question: z.string(),
            options: z.array(z.string()),
          }),
        )
        .min(1),
    }),
  }),
  // Pair Foundry / AI SDK dynamic tool part — present in assistant messages when
  // the LLM calls an MCP tool. The frontend echoes these parts back on subsequent turns.
  z.object({
    type: z.literal('dynamic-tool'),
    toolCallId: z.string(),
    toolName: z.string(),
    state: z.string(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('data-pipeState'),
    data: z.object({
      pipeId: z.string(),
      steps: z.array(
        z.object({
          id: z.string(),
          appKey: z.string(),
          key: z.string(),
          type: z.string(),
          position: z.number(),
          status: z.string(),
          parameters: z.record(z.string(), z.unknown()),
          connectionId: z.string().nullable(),
        }),
      ),
    }),
  }),
  // One entry per MCP bridge tool — keeps discriminatedUnion error quality intact.
  toolPart('tool-list_apps'),
  toolPart('tool-list_connections'),
  toolPart('tool-create_pipe'),
  toolPart('tool-update_step_parameters'),
  toolPart('tool-create_step'),
  toolPart('tool-delete_step'),
  toolPart('tool-get_dynamic_data'),
])

const messageSchema = z.object({
  /**
   * NOTE: we do not accept a 'system' role as this is handled by the system prompt.
   * It also serves as a basic form of protection against malicious input.
   */
  role: z.enum(['user', 'assistant']),
  /**
   * The parts of the message can be either text or a step start.
   * If the type is a 'step-start', there will not be any other key.
   */
  parts: z
    .array(messagePartSchema)
    .min(1, 'Message must have at least one part')
    .max(
      MAX_PARTS_PER_MESSAGE,
      `Message cannot have more than ${MAX_PARTS_PER_MESSAGE} parts`,
    ),
})

export const chatRequestSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1, 'Messages array must contain at least one message')
    .max(MAX_MESSAGES, `Cannot send more than ${MAX_MESSAGES} messages`),
  /**
   * Datadog RUM session UUID for debugging. Optional and allows empty string
   * (e.g., in dev) to avoid failing the API since we already have the user's email.
   */
  sessionId: z
    .string()
    .refine((val) => val === '' || UUID_REGEX.test(val), {
      message: 'Session ID must be a valid UUID',
    })
    .optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
