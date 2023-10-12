import { DateTime } from 'luxon'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { sendEmail } from '@/helpers/send-email'
import Flow from '@/models/flow'

const MAX_LENGTH = 80
export const redisClient = createRedisClient(REDIS_DB_INDEX.PIPE_ERRORS)

function truncateFlowName(flowName: string) {
  return flowName.length > MAX_LENGTH
    ? flowName.slice(0, MAX_LENGTH) + '...'
    : flowName
}

export function createBodyErrorMessage(flowName: string): string {
  const currDateTime = DateTime.now().toFormat('MMM dd yyyy, hh:mm a')
  const bodyMessage = `
    Dear fellow plumber,
    <br>
    <br>
    We have detected that your pipe: <strong>${flowName}</strong>, has encountered an error on ${currDateTime}.
    <br>
    <br>
    This could be because of the following:
    <ol>
      <li>One of the apps you are using may be down.</li>
      <li>Some parts of the pipe you have set up may not be working as intended.</li>
    </ol>
    <p>What should you do?</p>
    <ol>
      <li>Retry the failed execution by heading to the executions tab, and clicking the <strong>Retry</strong> button on the failed execution.</li>
      <li>Check our status page at https://status.plumber.gov.sg/ to see if Plumber or any of the apps you are using are down.</li>
      <li>Correct the configuration for your broken pipe.</li>
    </ol>
    <br>
    If you are still having issues with your pipe, reply to this email and we'd be happy to help you get your pipe running again!
    <br>
    <br>
    Regards,
    <br>
    Plumber Team
  `
  return bodyMessage
}

export async function checkErrorEmail(flowId: string): Promise<boolean> {
  const errorKey = `error-alert:${flowId}`
  return !!(await redisClient.exists(errorKey))
}

export async function sendErrorEmail(flow: Flow) {
  const truncatedFlowName = truncateFlowName(flow.name)
  const flowId = flow.id
  const userEmail = flow.user.email
  const errorKey = `error-alert:${flowId}`
  const currDatetime = DateTime.now()

  const errorDetails = {
    flowId,
    flowName: flow.name,
    userEmail,
    timestamp: currDatetime.toMillis(),
  }

  await sendEmail({
    subject: `Plumber: Possible error on ${truncatedFlowName}`,
    body: createBodyErrorMessage(truncatedFlowName),
    recipient: userEmail,
    replyTo: 'support@plumber.gov.sg',
  })

  await redisClient
    .multi()
    .hset(errorKey, errorDetails)
    .pexpireat(errorKey, currDatetime.endOf('day').toMillis())
    .exec()
  return errorDetails
}
