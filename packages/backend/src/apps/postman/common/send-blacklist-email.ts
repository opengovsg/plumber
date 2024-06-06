import { DateTime } from 'luxon'

import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { sendEmail } from '@/helpers/send-email'

const MAX_LENGTH = 80
const BLACKLIST_REQUEST_FORM_URL =
  'https://form.gov.sg/6661900c502545e6788fa3c4'
const redisClient = createRedisClient(REDIS_DB_INDEX.PIPE_ERRORS)

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

const blacklistRedisKey = (flowId: string, email: string) =>
  `blacklist-alert:${flowId}:${email}`

function truncateFlowName(flowName: string) {
  return flowName.length > MAX_LENGTH
    ? flowName.slice(0, MAX_LENGTH) + '...'
    : flowName
}

function createRequestBlacklistFormLink({
  userEmail,
  executionId,
  blacklistedRecipients,
}: BlacklistEmailProps) {
  const queryParams = new URLSearchParams({
    '666190bbfdd7e4abe8973b76': blacklistedRecipients.join(','),
    '666190371ace7810ab47cf65': executionId,
    '666191476a8b859f7f792a63': userEmail,
  })
  return BLACKLIST_REQUEST_FORM_URL + '?' + queryParams.toString()
}

function createBodyErrorMessage(props: BlacklistEmailProps): string {
  const { flowName, executionId, blacklistedRecipients } = props
  const appPrefixUrl = appConfig.isDev ? appConfig.webAppUrl : appConfig.baseUrl
  const redirectUrl = `/executions/${executionId}`
  const formattedUrl = `${appPrefixUrl}${redirectUrl}`

  const formLink = createRequestBlacklistFormLink(props)

  const bodyMessage = `
    Dear fellow plumber,
    <br>
    <br>
    We have detected that your pipe: <strong>${flowName}</strong> has attempted to send an email to one or more blacklisted email addresses:
    <ul>
      ${blacklistedRecipients.map((email) => `<li>${email}</li>`).join('\n')}
    </ul>
    Emails could be blacklisted for one of the following reasons:
    <ul>
      <li>The email address is invalid.</li>
      <li>The email address was temporarily deactivated (e.g. due to personnel movement across agencies).</li>
    </ul>
    <p>What should you do if you have verified that the email addresses are valid?</p>
    <ol>
      <li>Submit this form to request for the email addresses to be removed from the blacklist: <a href="${formLink}">Request to remove email from blacklist</a></li>
      <li>Wait for confirmation from us that the email adddress(es) have been removed from the blacklist successfully</li>
      <li>Retry sending the emails by clicking on <strong>Resend to blacklisted recipients</strong> on the failed execution page: ${formattedUrl}</li>
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
  const isNotified = await redisClient.mget(blacklistKeys)
  return emails.filter((_, i) => isNotified[i] !== '1')
}

async function addBlacklistedEmailToRedis(
  flowId: string,
  emails: string[],
): Promise<void> {
  await Promise.all(
    emails.map(async (email) => {
      const errorKey = blacklistRedisKey(flowId, email)
      await redisClient
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

  await addBlacklistedEmailToRedis(flowId, filteredBlacklist)

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
}
