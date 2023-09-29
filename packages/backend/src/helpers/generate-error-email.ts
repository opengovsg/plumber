import { DateTime } from 'luxon'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { sendEmail } from '@/helpers/send-email'
import Flow from '@/models/flow'

const MAX_LENGTH = 80
const redisClient = createRedisClient(REDIS_DB_INDEX.PIPE_ERRORS)

function truncateFlowName(flowName: string) {
  return flowName.length > MAX_LENGTH
    ? flowName.slice(0, MAX_LENGTH) + '...'
    : flowName
}

export function createBodyErrorMessage(flowName: string): string {
  const currDateTime = DateTime.now().toFormat('MMM dd yyyy, HH:mm:ss a')
  const bodyMessage = `
    Dear user,
    <br>
    <br>
    We have detected that your pipe: <strong>${flowName}</strong>, from plumber.gov.sg has failed as of ${currDateTime}.
    <br>
    Several scenarios could have caused this issue:
    <ol>
      <li>One of the apps you are using may be down.</li>
      <li>Some parts of the pipe you have set up may not be working as intended.</li>
    </ol>
    <br>
    Please check https://status.plumber.gov.sg/ to see if the status for Plumber is green or not. If one of the apps you are using are down, the plumber team would've already been alerted as well. 
    <br>
    <br>
    If the pipe issue is urgent, please log in to plumber.gov.sg and check the pipe. Please retry the pipe under the executions tab subsequently. Otherwise, you may respond to this email and request assistance from the Plumber support team.
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
      subject: `${truncatedFlowName} has execution errors`,
      body: createBodyErrorMessage(truncatedFlowName),
      recipient: userEmail,
      replyTo: 'support@plumber.gov.sg',
    })
  })
  // set redis key to expire at the end of the day
  redisClient.pexpireat(errorKey, currDatetime.endOf('day').toMillis())
}
