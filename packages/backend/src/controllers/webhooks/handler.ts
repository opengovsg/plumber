import { IRequest, ITriggerItem, SubtriggerData } from '@plumber/types'

import { randomUUID } from 'crypto'
import { Response } from 'express'
import { isEmpty, memoize } from 'lodash'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { z } from 'zod'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import Flow from '@/models/flow'
import { enqueueActionJob } from '@/queues/action'
import { processSubTrigger } from '@/services/sub-trigger'
import { type CustomWebhookResponse, processTrigger } from '@/services/trigger'

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

async function sendWebhookResponse(
  response: Response,
  customWebhookResponse?: CustomWebhookResponse,
) {
  if (customWebhookResponse) {
    response.setHeader('Content-Type', customWebhookResponse.contentType)
    return response.status(200).send(customWebhookResponse.body)
  }
  return response.sendStatus(200)
}

export default async (request: IRequest, response: Response) => {
  const span = tracer.scope().active()
  span?.setOperationName('webhooks.handler')

  const flowId = request.params.flowId

  try {
    z.string().uuid().parse(flowId)
  } catch {
    logger.info(`Invalid webhook flow id ${flowId}, not uuid`)
    return response.sendStatus(404)
  }

  const flow = await Flow.query().findById(flowId).withGraphJoined('user')

  if (!flow) {
    logger.info(`Flow not found for webhook id ${flowId}`)
    return response.sendStatus(404)
  }

  if (flow.config?.isForceClogged) {
    return response.sendStatus(423)
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

  let internalId: string = randomUUID()
  const testRun = !flow.active
  const triggerStep = await flow.getTriggerStep()

  const triggerApp = await triggerStep?.getApp()

  if (!triggerApp) {
    logger.info(`Trigger app not set up for flow ${flowId}`)
    return response.sendStatus(404)
  }

  const isWebhookApp = ['formsg', 'webhook', 'gathersg'].includes(
    triggerApp.key,
  )

  if (!isWebhookApp) {
    logger.info(`Invalid trigger app for flow${flowId}`)
    return response.sendStatus(404)
  }

  const triggerCommand = await triggerStep?.getTriggerCommand()
  // If trigger event is not selected, this should also return 404
  if (triggerCommand?.type !== 'webhook') {
    logger.info(
      `Trigger command not found or is not webhook type for flow${flowId}`,
    )
    return response.sendStatus(404)
  }

  let isSubtrigger = false
  /**
   * This is the workflow data which is currently mrf workflow content only
   */
  let subtriggerData: SubtriggerData | undefined

  if (triggerApp.auth?.verifyWebhook) {
    const $ = await globalVariable({
      flow,
      connection: await triggerStep.$relatedQuery('connection'),
      app: triggerApp,
      step: triggerStep,
      request,
    })

    const verifyResult = await triggerApp.auth.verifyWebhook($)

    if (!verifyResult.verified) {
      return response.sendStatus(401)
    }
    internalId = verifyResult.internalId
    isSubtrigger = verifyResult.isSubtrigger ?? false
    subtriggerData = verifyResult.subtriggerData
  }

  // in case trigger type is 'webhook'
  let payload = request.body

  // in case it's our built-in generic webhook trigger
  if (isWebhookApp) {
    payload = {
      ...(!isEmpty(request.query) ? { _query: request.query } : {}),
      ...request.body,
    }
  }

  const triggerItem: ITriggerItem = {
    raw: payload,
    meta: {
      internalId,
    },
  }

  // Handle MRF sub-trigger (subsequent workflow step submissions)
  if (!testRun && isSubtrigger && subtriggerData !== undefined) {
    const subTriggerResult = await processSubTrigger({
      flowId,
      triggerItem,
      subtriggerData,
    })

    span?.addTags({
      flowId,
      executionId: subTriggerResult?.executionId,
      appKey: triggerApp.key,
      testRun,
      isSubTrigger: true,
    })

    // No existing execution found or MRF step not found - return 200 but skip processing
    if (!subTriggerResult) {
      return response.sendStatus(200)
    }

    const { executionId, nextStep } = subTriggerResult

    // Enqueue the next step after the MRF action step
    if (nextStep) {
      const jobName = `${executionId}-${nextStep.id}`
      const jobData = {
        flowId,
        executionId,
        stepId: nextStep.id,
      }

      await enqueueActionJob({
        appKey: nextStep.appKey,
        actionKey: nextStep.key,
        jobName,
        jobData,
        jobOptions: DEFAULT_JOB_OPTIONS,
      })
    }

    return response.sendStatus(200)
  }

  /**
   * NOTE: special case for when FormSG calls Plumber's webhook twice for payment forms.
   * Plumber will still return a 200 status code, so that FormSG does not auto-retry,
   * but Plumber not enqueue the job.
   */
  const { executionId, shouldExecute, customWebhookResponse } =
    await processTrigger({
      flowId,
      stepId: triggerStep.id,
      triggerItem,
      testRun,
    })

  span?.addTags({
    flowId,
    executionId,
    stepId: triggerStep.id,
    appKey: triggerApp.key,
    testRun,
  })

  if (testRun || !shouldExecute) {
    return sendWebhookResponse(response, customWebhookResponse)
  }

  const nextStep = await triggerStep.getNextStep()
  const jobName = `${executionId}-${nextStep.id}`

  const jobData = {
    flowId,
    executionId,
    stepId: nextStep.id,
  }

  await enqueueActionJob({
    appKey: nextStep.appKey,
    actionKey: nextStep.key,
    jobName,
    jobData,
    jobOptions: DEFAULT_JOB_OPTIONS,
  })

  return sendWebhookResponse(response, customWebhookResponse)
}
