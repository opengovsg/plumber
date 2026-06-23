import logger from '@/helpers/logger'
import { incrementMetric } from '@/helpers/metrics'
import { SesEvent, SesEventType } from '@/helpers/ses-event-parser'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

export interface SesEventInput {
  sesEvent: SesEvent
  sqsMessageId: string
}

const SES_SIMULATOR_DOMAIN = 'simulator.amazonses.com'

/**
 * Whether an address is an AWS SES mailbox simulator address for the given
 * scenario. Sending to these generates real Bounce/Complaint events used to
 * exercise this pipeline, so they are excluded from the bounce/complaint
 * metrics — otherwise routine testing inflates the rates we alert on.
 *
 * Matches both the bare form (bounce@simulator.amazonses.com) and the
 * `+label` subaddress form (bounce+anylabel@simulator.amazonses.com), which
 * SES allows for sending multiple distinguishable test emails. Case-insensitive.
 */
function isSesSimulatorAddress(
  email: string,
  scenario: 'bounce' | 'complaint',
): boolean {
  const [localPart, domain] = email.toLowerCase().split('@')
  if (domain !== SES_SIMULATOR_DOMAIN) {
    return false
  }
  // Strip optional +label subaddressing before matching the scenario.
  return localPart.split('+')[0] === scenario
}

/**
 * Process a parsed SES event (called by the SQS consumer's handleMessage).
 *
 * NOTE on recipient arrays:
 *   `bouncedRecipients` and `complainedRecipients` are arrays per the SES
 *   spec, but in practice each event we receive will only contain ONE
 *   recipient. This is because our SES sender (sendViaSes) calls
 *   SendEmailCommand with a single `ToAddresses` per call. The loops below
 *   still iterate to remain faithful to the spec and to be safe if Phase 2
 *   ever introduces multi-recipient sends via SendBulkEmailCommand.
 */
export async function processSesEvent(data: SesEventInput): Promise<void> {
  const { sesEvent, sqsMessageId } = data
  const { mail } = sesEvent

  // sesEvent is a discriminated union on eventType (Bounce | Complaint), so the
  // payload for each branch is guaranteed present — no defensive null checks
  // needed, and the union is exhaustive.
  if (sesEvent.eventType === SesEventType.Bounce) {
    const { bounceType, bounceSubType, bouncedRecipients } = sesEvent.bounce

    if (bounceType === 'Permanent') {
      // Increment one bounce per recipient we actually suppress (matching the
      // per-recipient ses.email.sent denominator). Only permanent bounces
      // suppress, so the metric fires only here. The SES bounce simulator is
      // excluded so test sends don't skew the bounce rate.
      const meteredRecipients = bouncedRecipients.filter(
        (r) => !isSesSimulatorAddress(r.emailAddress, 'bounce'),
      )
      if (meteredRecipients.length > 0) {
        incrementMetric(
          'ses.email.bounce',
          {
            bounce_type: bounceType,
            bounce_sub_type: bounceSubType ?? 'unknown',
          },
          meteredRecipients.length,
        )
      }

      // TODO: add micro-optimisation for upsertSuppression to blacklist multiple recipient emails in phase 2
      for (const recipient of bouncedRecipients) {
        await EmailSuppressionEntry.upsertSuppression({
          email: recipient.emailAddress,
          reason: 'BOUNCE',
          reasonDetail: bounceSubType,
          sesMessageId: mail.messageId,
        })

        logger.info('Email suppressed due to permanent bounce', {
          event: 'ses-email-suppressed',
          email: recipient.emailAddress,
          bounceType,
          bounceSubType,
          sesMessageId: mail.messageId,
          sqsMessageId,
        })
      }
    } else {
      // Transient / Undetermined — log only, do not suppress
      logger.info('Transient bounce received — no suppression', {
        event: 'ses-transient-bounce',
        bounceType,
        bounceSubType,
        recipients: bouncedRecipients.map((r) => r.emailAddress),
        sesMessageId: mail.messageId,
        sqsMessageId,
      })
    }
    return
  }

  if (sesEvent.eventType === SesEventType.Complaint) {
    const { complainedRecipients, complaintFeedbackType } = sesEvent.complaint

    if (complaintFeedbackType === 'not-spam') {
      // Auto-whitelist: recipient marked the email as not-spam. No suppression
      // happens here, so the complaint metric is not incremented.
      const emails = complainedRecipients.map((r) => r.emailAddress)
      const whitelisted = await EmailSuppressionEntry.whitelistEmails(emails)

      logger.info('Auto-whitelisted emails due to not-spam complaint', {
        event: 'ses-auto-whitelist',
        whitelisted,
        sesMessageId: mail.messageId,
        sqsMessageId,
      })
    } else {
      // abuse, fraud, virus, other, null — suppress

      // Increment one complaint per recipient we actually suppress (matching
      // the per-recipient ses.email.sent denominator). Only this path
      // suppresses, so the metric fires only here. The SES complaint simulator
      // is excluded so test sends don't skew the complaint rate.
      const meteredRecipients = complainedRecipients.filter(
        (r) => !isSesSimulatorAddress(r.emailAddress, 'complaint'),
      )
      if (meteredRecipients.length > 0) {
        incrementMetric(
          'ses.email.complaint',
          {
            complaint_feedback_type: complaintFeedbackType ?? 'other',
          },
          meteredRecipients.length,
        )
      }

      for (const recipient of complainedRecipients) {
        await EmailSuppressionEntry.upsertSuppression({
          email: recipient.emailAddress,
          reason: 'COMPLAINT',
          reasonDetail: complaintFeedbackType ?? 'other',
          sesMessageId: mail.messageId,
        })

        logger.info('Email suppressed due to complaint', {
          event: 'ses-email-suppressed',
          email: recipient.emailAddress,
          complaintFeedbackType,
          sesMessageId: mail.messageId,
          sqsMessageId,
        })
      }
    }
    return
  }
}
