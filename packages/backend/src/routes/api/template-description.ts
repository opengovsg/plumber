import { APICallError } from 'ai'
import { Router } from 'express'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { z, ZodError } from 'zod'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { generateTemplateDescription } from '@/helpers/generate-template-description'
import logger from '@/helpers/logger'
import { isPlumPro } from '@/helpers/plumpro'

import { getAuthenticatedContext } from './middleware/authentication'

const router: Router = Router()
const bodySchema = z.object({ flowId: z.string().uuid() })
const limiter = new RateLimiterRedis({
  points: 5,
  duration: 60,
  keyPrefix: 'template-description',
  storeClient: createRedisClient(REDIS_DB_INDEX.RATE_LIMIT),
  rejectIfRedisNotReady: true,
})

type FailureCategory =
  | 'access-check-failed'
  | 'rate-limiter-unavailable'
  | 'pipe-lookup-failed'
  | 'provider-error'
  | 'timeout'
  | 'invalid-output'
  | 'unknown'

function generationFailureCategory(error: unknown): FailureCategory {
  if (APICallError.isInstance(error)) {
    return 'provider-error'
  }
  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return 'timeout'
  }
  if (error instanceof ZodError) {
    return 'invalid-output'
  }
  return 'unknown'
}

/**
 * IMPORTANT: logs only the error name and status code. Messages and request
 * bodies can carry the prompt, pipe details or credentials.
 */
function logFailure(
  category: FailureCategory,
  error: unknown,
  ids: { flowId: string; userId: string },
): void {
  logger.error('Template description generation failed', {
    event: 'template-description-generation-failed',
    category,
    errorName: error instanceof Error ? error.name : typeof error,
    ...(APICallError.isInstance(error) && { statusCode: error.statusCode }),
    ...ids,
  })
}

const UNAVAILABLE = { error: 'Description generation is unavailable' }

router.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  const user = getAuthenticatedContext(req).currentUser
  const ids = { flowId: parsed.data.flowId, userId: user.id }

  let isUserPlumPro
  try {
    isUserPlumPro = await isPlumPro(user.email)
  } catch (error) {
    logFailure('access-check-failed', error, ids)
    res.status(503).json(UNAVAILABLE)
    return
  }
  if (!isUserPlumPro) {
    res
      .status(403)
      .json({ error: 'Only PlumPros can convert pipes to templates' })
    return
  }

  try {
    await limiter.consume(user.id)
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      res
        .status(429)
        .json({ error: 'Too many description requests. Try again later.' })
      return
    }
    logFailure('rate-limiter-unavailable', error, ids)
    res.status(503).json(UNAVAILABLE)
    return
  }

  let flow
  try {
    flow = await user
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .withGraphFetched({ steps: true })
      .findOne({ 'flows.id': parsed.data.flowId })
  } catch (error) {
    logFailure('pipe-lookup-failed', error, ids)
    res.status(503).json(UNAVAILABLE)
    return
  }
  if (!flow) {
    res.status(404).json({ error: 'Pipe not found' })
    return
  }
  if (flow.role !== 'owner') {
    res
      .status(403)
      .json({ error: 'Only the pipe owner can convert it to a template' })
    return
  }
  if (flow.steps.length === 0 || flow.steps.length > 100) {
    res
      .status(400)
      .json({ error: 'Generate descriptions for pipes with 1 to 100 steps' })
    return
  }

  try {
    const description = await generateTemplateDescription(flow.steps)
    res.json({ description })
  } catch (error) {
    logFailure(generationFailureCategory(error), error, ids)
    res.status(503).json(UNAVAILABLE)
  }
})

export default router
