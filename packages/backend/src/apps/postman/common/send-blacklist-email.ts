import { DateTime } from 'luxon'

import { redisClient as pipeErrorRedisClient } from '@/helpers/generate-error-email'
import { sendEmail } from '@/helpers/send-email'

const MAX_LENGTH = 80
const BLACKLIST_REQUEST_FORM_URL =
  'https://form.gov.sg/6661900c502545e6788fa3c4'

interface SendBlacklistEmailProps {
  flowName: string
  flowId: string
  userEmail: string
  executionId: string
  blacklistedRecipients: string[]
}

interface BlacklistEmailProps {
  flowName: string
  userEmail: string
  executionId: string
  blacklistedRecipients: string[]
}

type BlacklistEmailFormProps = Omit<BlacklistEmailProps, 'flowName'>

const blacklistRedisKey = (flowId: string, email: string) =>
  `blacklist-alert:${flowId}:${email}`

function truncateFlowName(flowName: string) {
  return flowName.length > MAX_LENGTH
    ? flowName.slice(0, MAX_LENGTH) + '...'
    : flowName
}

export function createRequestBlacklistFormLink({
  userEmail,
  executionId,
  blacklistedRecipients,
}: BlacklistEmailFormProps) {
  const queryParams = new URLSearchParams({
    '666190bbfdd7e4abe8973b76': blacklistedRecipients.join(','),
    '666190371ace7810ab47cf65': executionId,
    '666191476a8b859f7f792a63': userEmail,
  })
  return BLACKLIST_REQUEST_FORM_URL + '?' + queryParams.toString()
}

function createBodyErrorMessage(props: BlacklistEmailProps): string {
  const { flowName, blacklistedRecipients } = props

  const formLink = createRequestBlacklistFormLink(props)

  const bodyMessage = `
    Dear fellow plumber,
    <br>
    <br>
    We have detected that your pipe <strong>${flowName}</strong> has attempted to send an email to one or more blacklisted email addresses:
    <ul>
      ${blacklistedRecipients.map((email) => `<li>${email}</li>`).join('\n')}
    </ul>
    Emails could be blacklisted for one of the following reasons:
    <ul>
      <li>The email address is invalid.</li>
      <li>The email address was temporarily deactivated (e.g. due to personnel movement across agencies).</li>
    </ul>
    <p>What should you do?</p>
    <ol>
      <li>Verify that the emails are valid by checking with the recipient.</li>
      <li>Submit <a href="${formLink}">this form</a> to request for the email addresses to be removed from the blacklist.</li>
      <li>Wait for an email confirmation from us (1-2 working days) for further instructions.</li>
    </ol>
    <br>
    Regards,
    <br>
    Plumber team
  `
  return bodyMessage
}

async function filterNotifiedEmails(
  flowId: string,
  emails: string[],
): Promise<string[]> {
  const blacklistKeys = emails.map((email) => blacklistRedisKey(flowId, email))
  /**
   * We cant use mget here to fetch multiple keys because our redis client has cluster mode enabled.
   * That means we cannot fetch keys from different slots in a single command. We can use braces to
   * set the hash key but for simplicity, we are fetching each key individually.
   * ref: https://repost.aws/knowledge-center/elasticache-crossslot-keys-error-redis
   */
  const isNotified = await Promise.all(
    blacklistKeys.map((key) => pipeErrorRedisClient.exists(key)),
  )
  return emails.filter((_, i) => !isNotified[i])
}

async function addBlacklistedEmailToRedis(
  flowId: string,
  emails: string[],
): Promise<void> {
  await Promise.all(
    emails.map(async (email) => {
      const errorKey = blacklistRedisKey(flowId, email)
      await pipeErrorRedisClient
        .multi()
        .set(errorKey, '1')
        .pexpireat(errorKey, DateTime.now().endOf('week').toMillis())
        .exec()
    }),
  )
  return
}

export async function sendBlacklistEmail({
  flowName,
  flowId,
  userEmail,
  executionId,
  blacklistedRecipients,
}: SendBlacklistEmailProps) {
  const truncatedFlowName = truncateFlowName(flowName)
  const filteredBlacklist = await filterNotifiedEmails(
    flowId,
    blacklistedRecipients,
  )

  if (filteredBlacklist.length === 0) {
    return
  }

  await sendEmail({
    subject: `Plumber: Blacklisted email detected on ${truncatedFlowName}`,
    body: createBodyErrorMessage({
      flowName,
      userEmail,
      executionId,
      blacklistedRecipients: filteredBlacklist,
    }),
    recipient: userEmail,
    replyTo: 'support@plumber.gov.sg',
  })

  await addBlacklistedEmailToRedis(flowId, filteredBlacklist)
}
