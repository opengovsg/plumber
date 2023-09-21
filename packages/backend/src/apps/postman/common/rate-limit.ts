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

export async function getRatelimitedRecipientList(recipients: string[]) {
  try {
    const res = await emailRateCounter.get('send')
    const remainingPoints = isNaN(res.remainingPoints)
      ? appConfig.postman.rateLimit
      : res.remainingPoints
    const pointsToConsume =
      recipients.length > remainingPoints ? remainingPoints : recipients.length
    await emailRateCounter.consume('send', pointsToConsume)
    return recipients.slice(0, pointsToConsume)
  } catch (e) {
    if (e instanceof RateLimiterRes) {
      // this will happen only if there're 2 email actions trying to consume at
      // the same time and pushing the rate to beyond limit (i.e. race condition between the read and consume)
      // In this case, we will just default to not sending out any email for this
      // action and put it back to wait
      return []
    }
    throw e
  }
}
