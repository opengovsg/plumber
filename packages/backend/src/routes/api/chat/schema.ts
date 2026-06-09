import { z } from 'zod/v4'

import { flowStepsSchema } from '@/helpers/ai/types'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Limits to protect API and LLM costs
const MAX_MESSAGES = 50
const MAX_TEXT_LENGTH = 10000 // characters per message part (~2,500 tokens)
const MAX_PARTS_PER_MESSAGE = 10

const messagePartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z
      .string()
      .trim()
      .min(1, 'Text cannot be empty')
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
            options: z.array(z.string()).min(2),
          }),
        )
        .min(1),
    }),
  }),
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
