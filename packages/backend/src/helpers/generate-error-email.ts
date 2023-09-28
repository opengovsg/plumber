import { DateTime } from 'luxon'

import { createRedisClient } from '@/config/redis'
import logger from '@/helpers/logger'
import { sendEmail } from '@/helpers/send-email'
import Flow from '@/models/flow'

const MAX_LENGTH = 80
const CURR_DATETIME = DateTime.now()

function truncateFlowName(flowName: string) {
  return flowName.length > MAX_LENGTH
    ? flowName.slice(0, MAX_LENGTH) + '...'
    : flowName
}

export function createBodyErrorMessage(flowName: string): string {
  const currDateTime = CURR_DATETIME.toFormat('MMM dd yyyy, HH:mm:ss a')
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

export async function sendErrorEmail(
  flow: Flow,
  userEmail: string,
  isTestRun: boolean,
) {
  if (isTestRun) {
    return
  }

  const truncatedFlowName = truncateFlowName(flow.name)
  const redisClient = createRedisClient()
  const flowId = flow.id
  const errorKey = `Pipe Id Error: ${flowId}`

  const errorDetails = {
    flowId,
    flowName: flow.name,
    userEmail,
    timestamp: CURR_DATETIME.toMillis(),
  }

  await redisClient
    .get(errorKey)
    .catch((err) => {
      logger.error('Unable to get redis key', {
        ...errorDetails,
        error: err.response,
      })
    })
    .then((result) => {
      if (result !== null) {
        return
      }

      redisClient.hset(errorKey, errorDetails, () => {
        sendEmail({
          subject: `${truncatedFlowName} has execution errors`,
          body: createBodyErrorMessage(truncatedFlowName),
          recipient: userEmail,
          replyTo: 'support@plumber.gov.sg',
        })
      })
      // set redis key to expire at the end of the day
      redisClient.expire(
        errorKey,
        DateTime.now().endOf('day').toMillis() - CURR_DATETIME.toMillis(),
      )
    })
}
