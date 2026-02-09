import { z } from 'zod'

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
   * Datadog RUM session IDs are always UUIDs
   */
  sessionId: z.string().uuid('Session ID must be a valid UUID').optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
