import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'
import MailComposer from 'nodemailer/lib/mail-composer'

import appConfig from '@/config/app'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

import logger from './logger'
import { incrementMetric } from './metrics'

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

export function shouldUseSes(
  recipientEmail: string,
  sesEnabledDomains: string[],
): boolean {
  if (sesEnabledDomains.length === 0) {
    return false
  }

  const normalizedEnabledDomains = sesEnabledDomains.map((d) =>
    d.trim().toLowerCase(),
  )

  if (normalizedEnabledDomains.includes('*')) {
    return true
  }

  const domain = recipientEmail.split('@')[1]?.toLowerCase()
  return domain ? normalizedEnabledDomains.includes(domain) : false
}

/**
 * Extensions blocked when sending via SES. These are the common executable
 * and script types used in phishing/malware payloads. Recipient mail servers
 * (Outlook/Gmail) typically block these too, but we drop them defensively
 * so SES never carries them.
 */
export const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  // Executables
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'pif',
  // Scripts
  'vbs',
  'vbe',
  'js',
  'jse',
  'wsf',
  'wsh',
  'ps1',
  // System / shortcut
  'reg',
  'inf',
  'lnk',
])

/**
 * SES raw email size limit is 10MB including base64 encoding overhead and
 * MIME headers. Base64 inflates payload by ~33%, so cap raw bytes at ~7MB
 * to leave headroom for headers.
 */
export const SES_MAX_ATTACHMENT_TOTAL_BYTES = 7 * 1024 * 1024

export interface SesAttachment {
  fileName: string
  data: Uint8Array
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  if (idx < 0 || idx === fileName.length - 1) {
    return ''
  }
  return fileName.slice(idx + 1).toLowerCase()
}

export function isBlockedAttachment(fileName: string): boolean {
  return BLOCKED_ATTACHMENT_EXTENSIONS.has(getExtension(fileName))
}

/**
 * Split incoming attachments into allowed vs blocked. Blocked attachments
 * are dropped from the send; callers can use the `blocked` array to
 * notify the user (e.g. via sendInvalidAttachmentsEmail).
 */
export function filterSesAttachments(attachments: SesAttachment[]): {
  allowed: SesAttachment[]
  blocked: string[]
} {
  const allowed: SesAttachment[] = []
  const blocked: string[] = []
  for (const att of attachments) {
    if (isBlockedAttachment(att.fileName)) {
      blocked.push(att.fileName)
    } else {
      allowed.push(att)
    }
  }
  return { allowed, blocked }
}

interface SesEmailParams {
  subject: string
  body: string
  recipient: string
  replyTo?: string
  cc?: string[]
  attachments?: SesAttachment[]
}

/**
 * Build a raw MIME message via nodemailer's MailComposer. MailComposer
 * handles RFC-compliant header encoding, base64 wrapping, boundary safety,
 * and CRLF line endings — all the parts of MIME we don't want to roll
 * ourselves. SES v2's `Content.Raw` accepts the resulting Buffer directly.
 */
async function buildRawMimeMessage(params: {
  fromAddress: string
  recipient: string
  cc?: string[]
  replyTo?: string
  subject: string
  htmlBody: string
  attachments: SesAttachment[]
}): Promise<Buffer> {
  const composer = new MailComposer({
    from: params.fromAddress,
    to: params.recipient,
    cc: params.cc?.length ? params.cc : undefined,
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.htmlBody,
    attachments: params.attachments.map((a) => ({
      filename: a.fileName,
      content: Buffer.from(a.data),
    })),
  })
  return await composer.compile().build()
}

export async function sendEmailViaSes({
  subject,
  body,
  recipient,
  replyTo,
  cc,
  attachments,
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

  // Apply the denylist defensively even if the caller filtered upstream.
  // A blocked extension reaching this layer is unexpected, so warn so
  // operators can investigate the upstream filter.
  const { allowed, blocked } = filterSesAttachments(attachments ?? [])
  if (blocked.length > 0) {
    logger.warn('Blocked attachment(s) dropped before SES send', {
      event: 'ses-blocked-attachment',
      recipient,
      blocked,
    })
  }

  // Fail fast on oversized payloads so SES doesn't reject a 10MB+ raw
  // message after we've built it.
  const totalBytes = allowed.reduce((sum, a) => sum + a.data.byteLength, 0)
  if (totalBytes > SES_MAX_ATTACHMENT_TOTAL_BYTES) {
    logger.error('Attachments too large for SES send', {
      event: 'ses-attachment-too-large',
      recipient,
      totalBytes,
      maxBytes: SES_MAX_ATTACHMENT_TOTAL_BYTES,
    })
    throw new Error(
      `Attachments exceed maximum total size of ${SES_MAX_ATTACHMENT_TOTAL_BYTES} bytes`,
    )
  }

  try {
    const hasAttachments = allowed.length > 0
    let command: SendEmailCommand

    if (hasAttachments) {
      const rawMessage = await buildRawMimeMessage({
        fromAddress,
        recipient,
        cc,
        replyTo,
        subject,
        htmlBody: body,
        attachments: allowed,
      })

      command = new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: [recipient],
          ...(cc?.length && { CcAddresses: cc }),
        },
        Content: { Raw: { Data: rawMessage } },
        ...(replyTo && { ReplyToAddresses: [replyTo] }),
        ...(appConfig.ses.configurationSet && {
          ConfigurationSetName: appConfig.ses.configurationSet,
        }),
      })
    } else {
      command = new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: [recipient],
          ...(cc?.length && { CcAddresses: cc }),
        },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: body, Charset: 'UTF-8' } },
          },
        },
        ...(replyTo && { ReplyToAddresses: [replyTo] }),
        ...(appConfig.ses.configurationSet && {
          ConfigurationSetName: appConfig.ses.configurationSet,
        }),
      })
    }

    await client.send(command)
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
      error: e,
      recipient,
    })
    throw e
  }
}
