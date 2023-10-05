import { DateTime } from 'luxon'

import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { sendEmail } from '@/helpers/send-email'
import Flow from '@/models/flow'

const MAX_LENGTH = 80
const redisClient = createRedisClient(REDIS_DB_INDEX.PIPE_ERRORS)

function redirectFlowLink(flowId: string) {
  return `${
    appConfig.isDev ? appConfig.webAppUrl : appConfig.baseUrl
  }/editor/${flowId}`
}

function truncateFlowName(flowName: string) {
  return flowName.length > MAX_LENGTH
    ? flowName.slice(0, MAX_LENGTH) + '...'
    : flowName
}

export function createBodyErrorMessage(
  flowName: string,
  flowId: string,
): string {
  const currDateTime = DateTime.now().toFormat('MMM dd yyyy, HH:mm:ss a')
  const bodyMessage = `
    Dear Plumber admin,
    <br>
    <br>
    We have detected that your pipe: <strong>${flowName}</strong>, has failed as of ${currDateTime}.
    <br>
    <br>
    This could be because of the following:
    <ol>
      <li>One of the apps you are using may be down.</li>
      <li>Some parts of the pipe you have set up may not be working as intended.</li>
    </ol>
    <br>
    <p>What should you do?</p>
    <ol>
      <li>Retry the failed execution by heading to the executions tab, filter for failures and click on retry button.</li>
      <li>Check our status page at https://status.plumber.gov.sg/ to see if Plumber or any of the apps you are using are down.</li>
      <li>Edit your pipe at ${redirectFlowLink(flowId)}
    </ol>
    <br>
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

export async function checkErrorEmail(flowId: string) {
  const errorKey = `error-alert:${flowId}`
  return await redisClient.hexists(errorKey, 'flowId')
}

export async function sendErrorEmail(flow: Flow, userEmail: string) {
  const truncatedFlowName = truncateFlowName(flow.name)
  const flowId = flow.id
  const errorKey = `error-alert:${flowId}`
  const currDatetime = DateTime.now()

  const errorDetails = {
    flowId,
    flowName: flow.name,
    userEmail,
    timestamp: currDatetime.toMillis(),
  }

  await redisClient.hset(errorKey, errorDetails, () => {
    sendEmail({
      subject: `Plumber: Possible error on ${truncatedFlowName}`,
      body: createBodyErrorMessage(truncatedFlowName, flowId),
      recipient: userEmail,
      replyTo: 'support@plumber.gov.sg',
    })
  })
  // set redis key to expire at the end of the day
  redisClient.pexpireat(errorKey, currDatetime.endOf('day').toMillis())
}
