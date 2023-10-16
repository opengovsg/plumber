import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'

import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'

const redisRateLimitClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)
const emailRateCounter = new RateLimiterRedis({
  points: appConfig.postman.rateLimit,
  duration: 1,
  keyPrefix: 'action-email',
  storeClient: redisRateLimitClient,
})

type RateLimitedResults = {
  recipients: Array<string>
  newProgress: number
}
export async function getRatelimitedRecipientList(
  allRecipients: string[],
  progress: number,
): Promise<RateLimitedResults> {
  try {
    const res = await emailRateCounter.get('send')
    const remainingPoints = isNaN(res.remainingPoints)
      ? appConfig.postman.rateLimit
      : res.remainingPoints
    const recipients = allRecipients.slice(progress)
    const pointsToConsume =
      recipients.length > remainingPoints ? remainingPoints : recipients.length
    const recipientsToSend = recipients.slice(0, pointsToConsume)
    await emailRateCounter.consume('send', pointsToConsume)
    return {
      recipients: recipientsToSend,
      newProgress: progress + recipientsToSend.length,
    }
  } catch (e) {
    if (e instanceof RateLimiterRes) {
      // this will happen only if there're 2 email actions trying to consume at
      // the same time and pushing the rate to beyond limit (i.e. race condition between the read and consume)
      // In this case, we will just default to not sending out any email for this
      // action and put it back to wait
      return {
        recipients: [],
        newProgress: progress,
      }
    }
    throw e
  }
}
