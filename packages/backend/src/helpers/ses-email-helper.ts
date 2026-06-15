import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'

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
              Html: { Data: body, Charset: 'UTF-8' },
            },
          },
        },
        ...(replyTo && { ReplyToAddresses: [replyTo] }),
        ...(appConfig.ses.configurationSet && {
          ConfigurationSetName: appConfig.ses.configurationSet,
        }),
      }),
    )
    incrementMetric('ses.email.sent')
  } catch (e) {
    logger.error('Error sending email via SES, please try again later.', {
      event: 'ses-email-failed',
      error: e,
      recipient,
    })
    throw e
  }
}
