import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'

import appConfig from '@/config/app'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

import { getLdFlagValue } from './launch-darkly'
import logger from './logger'
import { incrementMetric } from './metrics'
import { sanitizeEmailHtml } from './sanitize-email-html'

let sesClient: SESv2Client | null = null

export function getSesClient(): SESv2Client {
  if (!sesClient) {
    sesClient = new SESv2Client({
      region: appConfig.ses.region,
      credentials: fromTemporaryCredentials({
        params: {
          RoleArn: appConfig.ses.roleArn,
          ExternalId: 'plumber-ses-access',
        },
      }),
    })
  }
  return sesClient
}

/**
 * Whether SES routing is enabled for a recipient. `ses_enabled` is a boolean
 * flag; which recipients/domains/segments it applies to is configured in
 * LaunchDarkly. The recipient email is passed as the `user` context key (the
 * same kind {@link getLdFlagValue} uses), so LD rules can target by "user key
 * ends with @domain", individual email targets, or segments. The email is
 * lower-cased because LD string operators are case-sensitive. Defaults to false
 * (routes via Postman) when the flag is off or unset.
 */
export function isSesEnabledForRecipient(
  recipientEmail: string,
): Promise<boolean> {
  return getLdFlagValue<boolean>(
    'ses_enabled',
    recipientEmail.toLowerCase(),
    false,
  )
}

/**
 * Whether attachment-over-SES is enabled for a recipient.
 * `ses_attachments_enabled` is a boolean flag, targeted in LaunchDarkly the same
 * way as `ses_enabled`. It is additive: an email with attachments uses SES only
 * when both flags are on for all recipients. Defaults to false (routes via
 * Postman) when the flag is off or unset.
 */
export function isSesAttachmentsEnabledForRecipient(
  recipientEmail: string,
): Promise<boolean> {
  return getLdFlagValue<boolean>(
    'ses_attachments_enabled',
    recipientEmail.toLowerCase(),
    false,
  )
}

/**
 * Build an RFC 5322 From address (`Display Name <email>`).
 *
 * If the display name contains "specials" — most importantly a comma — it must
 * be a quoted-string, otherwise the address is malformed (e.g. `Acme, Inc
 * <x@y>` parses as two addresses) and SES rejects it with a BadRequestException
 * while Postman silently tolerates it. We quote only when needed so simple
 * names are unchanged, escaping any embedded `"`/`\`.
 */
export function formatFromAddress(displayName: string, email: string): string {
  const needsQuoting = /[,;:<>@()[\]\\"]/.test(displayName)
  const name = needsQuoting
    ? `"${displayName.replace(/(["\\])/g, '\\$1')}"`
    : displayName
  return `${name} <${email}>`
}

interface SesEmailParams {
  subject: string
  body: string
  recipient: string
  replyTo?: string
  cc?: string[]
}

export async function sendEmailViaSes({
  subject,
  body,
  recipient,
  replyTo,
  cc,
}: SesEmailParams): Promise<void> {
  const client = getSesClient()
  const fromAddress = `Plumber <${appConfig.ses.fromAddress}>`

  // Pre-send suppression check: block sending to recipients that previously
  // bounced/complained (mirrors Postman's blacklist rejection). Throwing here
  // surfaces as an alert banner via the caller's error handling.
  const suppressed = await EmailSuppressionEntry.getSuppressedEmails([
    recipient,
  ])
  if (suppressed.length > 0) {
    logger.info('Blacklisted email', { email: recipient })

    throw new Error(
      'Your email is on our suppression list (it previously bounced or reported spam).',
    )
  }

  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: [recipient],
          ...(cc?.length && { CcAddresses: cc }),
        },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              // SES sends the body verbatim; sanitise to match the server-side
              // filtering the Postman path gets for free.
              Html: { Data: sanitizeEmailHtml(body), Charset: 'UTF-8' },
            },
            // Marks the message as sent via the SES direct path (absent =>
            // routed through Postman). Recipient-invisible; for triage only.
            Headers: [{ Name: 'X-Plumber-Transport', Value: 'ses' }],
          },
        },
        ...(replyTo && { ReplyToAddresses: [replyTo] }),
        ...(appConfig.ses.configurationSet && {
          ConfigurationSetName: appConfig.ses.configurationSet,
        }),
      }),
    )
    incrementMetric('ses.email.sent')

    // TODO: remove this log once the SES rollout is verified and stable.
    logger.info('System email sent via SES', {
      event: 'system-ses-email-sent',
      subject,
      from: fromAddress,
      recipient,
    })
  } catch (e) {
    logger.error('Error sending email via SES, please try again later.', {
      event: 'ses-email-failed',
      recipient,
      errorName: e instanceof Error ? e.name : undefined,
      // e.message is non-enumerable, so `error: e` alone drops the actual
      // reason — log it explicitly. Keep the full error for the stack too.
      errorMessage: e instanceof Error ? e.message : String(e),
      httpStatus: (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode,
    })
    throw e
  }
}
