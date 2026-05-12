export enum SesEventType {
  Bounce = 'Bounce',
  Complaint = 'Complaint',
}

interface BouncedRecipient {
  emailAddress: string
  action?: string
  status?: string
  diagnosticCode?: string
}

interface ComplainedRecipient {
  emailAddress: string
}

interface SesBounce {
  bounceType: 'Permanent' | 'Transient' | 'Undetermined'
  bounceSubType: string
  bouncedRecipients: BouncedRecipient[]
  timestamp: string
  feedbackId: string
}

interface SesComplaint {
  complainedRecipients: ComplainedRecipient[]
  timestamp: string
  feedbackId: string
  complaintFeedbackType?: string
  complaintSubType?: string
}

interface SesMail {
  timestamp: string
  source: string
  sendingAccountId?: string
  messageId: string
  destination: string[]
}

export interface SesEvent {
  eventType: SesEventType
  bounce?: SesBounce
  complaint?: SesComplaint
  mail: SesMail
}

/**
 * Parses an SQS message body containing an SNS-wrapped SES event.
 *
 * Message nesting: SQS body (string) -> SNS envelope (JSON with `Message` field)
 * -> SES event (JSON string inside `Message`).
 */
export function parseSqsMessage(sqsBody: string): SesEvent {
  const snsEnvelope = JSON.parse(sqsBody)

  if (!snsEnvelope.Message) {
    throw new Error('Missing Message field in SNS envelope')
  }

  const sesEvent = JSON.parse(snsEnvelope.Message)

  if (!sesEvent.eventType) {
    throw new Error('Missing eventType in SES event')
  }

  return sesEvent as SesEvent
}
