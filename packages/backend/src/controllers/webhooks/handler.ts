import { IRequest, ITriggerItem } from '@plumber/types'

import { randomUUID } from 'crypto'
import { Response } from 'express'
import { memoize } from 'lodash'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { z } from 'zod'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import Flow from '@/models/flow'
import actionQueue from '@/queues/action'
import { processTrigger } from '@/services/trigger'

const DEFAULT_MAX_QPS = 10

const redisRateLimitClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)

// Memoize to prevent high QPS flows with different limits from creating a hot
// path.
const getRateLimiter = memoize((maxQps: number): RateLimiterRedis => {
  return new RateLimiterRedis({
    points: maxQps,
    duration: 1,

    keyPrefix: 'webhook-rate',
    storeClient: redisRateLimitClient,
  })
})

export default async (request: IRequest, response: Response) => {
  const span = tracer.scope().active()
  span?.setOperationName('webhooks.handler')

  const flowId = request.params.flowId

  try {
    z.string().uuid().parse(flowId)
  } catch (err) {
    logger.info(`Invalid webhook flow id ${flowId}, not uuid`)
    return response.sendStatus(404)
  }

  const flow = await Flow.query().findById(flowId).withGraphJoined('user')

  if (!flow) {
    logger.info(`Flow not found for webhook id ${flowId}}`)
    return response.sendStatus(404)
  }

  const { maxQps = DEFAULT_MAX_QPS, rejectIfOverMaxQps = true } =
    flow.config ?? {}

  const rateLimiter = getRateLimiter(maxQps)
  try {
    await rateLimiter.consume(flowId)
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      logger.warn(`Rate limited flow ${flowId}`, {
        event: 'webhook-rate-limited',
        flowId,
      })

      if (rejectIfOverMaxQps) {
        return response.sendStatus(429)
      }
    }
  }

  const testRun = !flow.active
  const triggerStep = await flow.getTriggerStep()
  const triggerCommand = await triggerStep.getTriggerCommand()
  const app = await triggerStep.getApp()
  const isWebhookApp =
    app.key === 'webhook' ||
    app.key === 'formsg' ||
    app.key === 'vault-workspace'

  // Allow all webhook test runs to work
  if (testRun && !isWebhookApp) {
    return response.sendStatus(404)
  }

  // If trigger event is not selected, this should also return 404
  if (triggerCommand?.type !== 'webhook') {
    return response.sendStatus(404)
  }

  if (app.auth?.verifyWebhook) {
    const $ = await globalVariable({
      flow,
      connection: await triggerStep.$relatedQuery('connection'),
      app,
      step: triggerStep,
      request,
    })

    const verified = await app.auth.verifyWebhook($)

    if (!verified) {
      return response.sendStatus(401)
    }
  }

  // in case trigger type is 'webhook'
  let payload = request.body

  // in case it's our built-in generic webhook trigger
  if (isWebhookApp) {
    payload = {
      ...request.body,
    }
  }

  const triggerItem: ITriggerItem = {
    raw: payload,
    meta: {
      internalId: randomUUID(),
    },
  }

  const { executionId } = await processTrigger({
    flowId,
    stepId: triggerStep.id,
    triggerItem,
    testRun,
  })

  span?.addTags({
    flowId,
    executionId,
    stepId: triggerStep.id,
    appKey: app.key,
    testRun,
  })

  if (testRun) {
    return response.sendStatus(200)
  }

  const nextStep = await triggerStep.getNextStep()
  const jobName = `${executionId}-${nextStep.id}`

  const jobPayload = {
    flowId,
    executionId,
    stepId: nextStep.id,
  }

  await actionQueue.add(jobName, jobPayload, DEFAULT_JOB_OPTIONS)

  return response.sendStatus(200)
}
