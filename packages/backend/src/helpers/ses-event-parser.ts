import { z } from 'zod'

export enum SesEventType {
  Bounce = 'Bounce',
  Complaint = 'Complaint',
}

// SES omits-or-nulls optional fields, so accept both null and undefined.
const optionalString = z.string().nullish()

const bouncedRecipientSchema = z.object({
  emailAddress: z.string(),
  action: optionalString,
  status: optionalString,
  diagnosticCode: optionalString,
})

const complainedRecipientSchema = z.object({
  emailAddress: z.string(),
})

const sesBounceSchema = z.object({
  bounceType: z.enum(['Permanent', 'Transient', 'Undetermined']),
  bounceSubType: z.string(),
  bouncedRecipients: z.array(bouncedRecipientSchema),
  timestamp: z.string(),
  feedbackId: z.string(),
})

const sesComplaintSchema = z.object({
  complainedRecipients: z.array(complainedRecipientSchema),
  timestamp: z.string(),
  feedbackId: z.string(),
  complaintFeedbackType: optionalString,
  complaintSubType: optionalString,
})

const sesMailSchema = z.object({
  timestamp: z.string(),
  source: z.string(),
  sendingAccountId: optionalString,
  messageId: z.string(),
  destination: z.array(z.string()),
})

const bounceEventSchema = z.object({
  eventType: z.literal(SesEventType.Bounce),
  bounce: sesBounceSchema,
  mail: sesMailSchema,
})

const complaintEventSchema = z.object({
  eventType: z.literal(SesEventType.Complaint),
  complaint: sesComplaintSchema,
  mail: sesMailSchema,
})

// Bounce + Complaint are the only events we handle. Any other eventType (the
// SES config set may also publish Delivery/Open/Send/... to the same topic)
// fails this strict union and is treated as a poison message by the consumer —
// the intended signal to tighten the SNS subscription filter upstream.
const sesEventSchema = z.discriminatedUnion('eventType', [
  bounceEventSchema,
  complaintEventSchema,
])

// SNS wraps the SES event JSON as a string in its `Message` field.
const snsEnvelopeSchema = z.object({
  Message: z.string(),
})

export type SesEvent = z.infer<typeof sesEventSchema>

/**
 * Parses an SQS message body containing an SNS-wrapped SES event.
 *
 * Message nesting: SQS body (string) -> SNS envelope (JSON with `Message` field)
 * -> SES event (JSON string inside `Message`).
 *
 * Throws if the body isn't valid JSON (SyntaxError) or the payload doesn't
 * match a Bounce/Complaint event (ZodError) — the consumer treats either as a
 * poison message.
 */
export function parseSqsMessage(sqsBody: string): SesEvent {
  const { Message } = snsEnvelopeSchema.parse(JSON.parse(sqsBody))
  return sesEventSchema.parse(JSON.parse(Message))
}
