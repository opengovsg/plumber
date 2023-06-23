import { IRequest, ITriggerItem } from '@plumber/types'

import { Response } from 'express'
import { memoize } from 'lodash'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { z } from 'zod'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { sha256Hash } from '@/helpers/crypto'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import Flow from '@/models/flow'
import actionQueue from '@/queues/action'
import { processTrigger } from '@/services/trigger'

const redisRateLimitClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)

// Memoize to prevent high QPS flows with different limits from creating a hot
// path.
const DEFAULT_MAX_QPS = 10
const getRateLimiter = memoize((maxQps: number): RateLimiterRedis => {
  const allowedQps = maxQps ?? DEFAULT_MAX_QPS

  return new RateLimiterRedis({
    points: allowedQps,
    duration: 1,

    keyPrefix: 'flow-exec',
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

  const flow = await Flow.query().findById(request.params.flowId)

  if (!flow) {
    logger.info(`Flow not found for webhook id ${flowId}}`)
    return response.sendStatus(404)
  }

  const rateLimiter = getRateLimiter(flow.maxQps)
  try {
    await rateLimiter.consume(flowId)
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      logger.warn(`Rate limited flow ${flowId}`, {
        event: 'flow-rate-limited',
        flowId,
      })
      return response.sendStatus(429)
    } else {
      logger.error(`Got error "${error}" while rate limiting ${flowId}`, {
        event: 'flow-rate-limit-error',
        flowId,
        error,
      })
      return response.sendStatus(500)
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

  if (triggerCommand.type !== 'webhook') {
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
  let rawInternalId: string | Buffer = request.rawBody

  // in case it's our built-in generic webhook trigger
  if (isWebhookApp) {
    payload = {
      ...request.body,
    }

    rawInternalId = JSON.stringify(payload)
  }

  const triggerItem: ITriggerItem = {
    raw: payload,
    meta: {
      internalId: sha256Hash(rawInternalId),
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
