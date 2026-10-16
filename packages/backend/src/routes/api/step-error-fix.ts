import { randomUUID } from 'crypto'
import type { Response } from 'express'
import { Router } from 'express'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import {
  AI_CHAT_GENERIC_ERROR_MESSAGE,
  getAiChatErrorMessage,
} from '@/helpers/ai/get-ai-chat-error-message'
import { getClientIp } from '@/helpers/get-client-ip'
import logger from '@/helpers/logger'
import {
  fixStepError,
  GuideUnavailableError,
  stepErrorFixRequestSchema,
} from '@/services/step-error-fix'
import type { AuthenticatedRequest } from '@/types/express/context'

const stepErrorFixLimiter = new RateLimiterRedis({
  points: 10,
  duration: 60,
  keyPrefix: 'step-error-fix',
  storeClient: createRedisClient(REDIS_DB_INDEX.RATE_LIMIT),
})

export async function postStepErrorFix(
  req: AuthenticatedRequest,
  res: Response,
) {
  const parsed = stepErrorFixRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }

  const traceId = randomUUID()
  try {
    const data = await fixStepError(parsed.data, {
      traceId,
      user: req.context.currentUser,
    })
    res.json({ data })
  } catch (error) {
    if (error instanceof GuideUnavailableError) {
      res.status(503).json({ error: error.message })
      return
    }
    logger.error('Step error fix failed', {
      event: 'step-error-fix-failed',
      traceId,
      appKey: parsed.data.appKey,
      stepKey: parsed.data.stepKey,
      error: error instanceof Error ? error.message : String(error),
    })
    res.status(500).json({
      error: getAiChatErrorMessage(error) || AI_CHAT_GENERIC_ERROR_MESSAGE,
    })
  }
}

const router = Router()

router.post(
  '/',
  async (req: AuthenticatedRequest, res, next) => {
    const userId = req.context?.currentUser?.id
    const userIp = getClientIp(req)
    try {
      await stepErrorFixLimiter.consume(userId || userIp)
      next()
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        res.status(429).json({
          error: 'Too many fix requests. Please try again.',
        })
        return
      }
      logger.error('Error in step error fix rate limiting', { error })
      next()
    }
  },
  postStepErrorFix,
)

export default router
