import { Router } from 'express'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { z } from 'zod'

import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { generateTemplateDescription } from '@/helpers/generate-template-description'
import logger from '@/helpers/logger'
import type { AuthenticatedRequest } from '@/types/express/context'

const router = Router()
const bodySchema = z.object({ flowId: z.string().uuid() })
const limiter = new RateLimiterRedis({
  points: 5,
  duration: 60,
  keyPrefix: 'template-description',
  storeClient: createRedisClient(REDIS_DB_INDEX.RATE_LIMIT),
  rejectIfRedisNotReady: true,
})

router.post('/', async (req: AuthenticatedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  const user = req.context.currentUser
  try {
    await limiter.consume(user.id)
    const flow = await user
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .withGraphFetched({ steps: true })
      .findOne({ 'flows.id': parsed.data.flowId })
    if (!flow) {
      res.status(404).json({ error: 'Pipe not found' })
      return
    }
    if (!appConfig.templateDescription.apiKey) {
      res.status(503).json({ error: 'Description generation is unavailable' })
      return
    }
    if (flow.steps.length === 0 || flow.steps.length > 100) {
      res
        .status(400)
        .json({ error: 'Generate descriptions for pipes with 1 to 100 steps' })
      return
    }
    const description = await generateTemplateDescription(flow.steps)
    res.json({ description })
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      res
        .status(429)
        .json({ error: 'Too many description requests. Try again later.' })
      return
    }
    // Provider errors can contain prompts and authorization details.
    logger.error('Template description generation failed', {
      event: 'template-description-generation-failed',
      flowId: parsed.data.flowId,
      userId: user.id,
    })
    res.status(503).json({ error: 'Description generation is unavailable' })
  }
})

export default router
