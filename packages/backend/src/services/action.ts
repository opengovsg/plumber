import { type IActionRunResult } from '@plumber/types'
import { IJSONObject } from '@plumber/types'

import { Worker } from 'bullmq'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'

import postman from '@/apps/postman'
import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import CancelFlowError from '@/errors/cancel-flow'
import HttpError from '@/errors/http'
import computeParameters from '@/helpers/compute-parameters'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'

type ProcessActionOptions = {
  flowId: string
  executionId: string
  stepId: string
  jobId?: string
  testRun?: boolean
  worker?: Worker
}

const redisRateLimitClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)
const emailRateCounter = new RateLimiterRedis({
  points: appConfig.postman.rateLimit,
  duration: 5,
  keyPrefix: 'action-email',
  storeClient: redisRateLimitClient,
})
type RateLimiterFuncReturnValue = {
  isRateLimited: boolean
  duration: number
}
type RateLimiterFunc = (
  data: IJSONObject,
) => Promise<RateLimiterFuncReturnValue>
const rateLimiters: Record<string, RateLimiterFunc> = {
  [postman.key]: async (data: {
    destinationEmail: string[]
  }): Promise<RateLimiterFuncReturnValue> => {
    try {
      await emailRateCounter.consume(data.destinationEmail.length)
      return {
        isRateLimited: false,
        duration: emailRateCounter.duration,
      }
    } catch (e) {
      if (e instanceof RateLimiterRes) {
        return {
          isRateLimited: true,
          duration: emailRateCounter.duration,
        }
      }
      throw e
    }
  },
}

export const processAction = async (options: ProcessActionOptions) => {
  const { flowId, stepId, executionId, jobId, worker, testRun } = options

  const step = await Step.query().findById(stepId).throwIfNotFound()
  const flow = await Flow.query().findById(flowId).throwIfNotFound()
  const execution = await Execution.query()
    .findById(executionId)
    .throwIfNotFound()

  const $ = await globalVariable({
    flow,
    app: await step.getApp(),
    step: step,
    connection: await step.$relatedQuery('connection'),
    execution: execution,
    testRun,
  })

  const priorExecutionSteps = await ExecutionStep.query().where({
    execution_id: $.execution.id,
    // only get successful execution steps
    status: 'success',
  })

  const actionCommand = await step.getActionCommand()

  const computedParameters = computeParameters(
    $.step.parameters,
    priorExecutionSteps,
    actionCommand.preprocessVariable,
  )

  $.step.parameters = computedParameters
  if (rateLimiters[$.app.key] && worker) {
    const { isRateLimited, duration } = await rateLimiters[$.app.key](
      $.step.parameters,
    )
    if (isRateLimited) {
      await worker.rateLimit(duration)
      throw Worker.RateLimitError()
    }
  }

  let runResult: IActionRunResult = {}
  try {
    // Cannot assign directly to runResult due to void return type.
    const result =
      testRun && actionCommand.testRun
        ? await actionCommand.testRun($)
        : await actionCommand.run($)
    if (result) {
      runResult = result
    }
  } catch (error) {
    if (error instanceof CancelFlowError) {
      // don't log error for cancel flow
      runResult.nextStep = { command: 'stop-execution' }
    } else {
      logger.error(error)
      if (error instanceof HttpError) {
        $.actionOutput.error = {
          details: error.details,
          status: error.response.status,
          statusText: error.response.statusText,
        }
      } else {
        try {
          $.actionOutput.error = JSON.parse(error.message)
        } catch {
          $.actionOutput.error = { error: error.message }
        }
      }
    }
  }

  const executionStep = await execution
    .$relatedQuery('executionSteps')
    .insertAndFetch({
      stepId: $.step.id,
      status: $.actionOutput.error ? 'failure' : 'success',
      dataIn: computedParameters,
      dataOut: $.actionOutput.error ? null : $.actionOutput.data?.raw,
      errorDetails: $.actionOutput.error ? $.actionOutput.error : null,
      appKey: $.app.key,
      jobId,
    })

  let nextStep = null
  switch (runResult.nextStep?.command) {
    case 'jump-to-step':
      nextStep = await flow
        .$relatedQuery('steps')
        .findById(runResult.nextStep.stepId)
        .throwIfNotFound()
      break
    case 'stop-execution':
      // Nothing to do, nextStep is already null.
      break
    default:
      nextStep = await step.getNextStep()
  }

  return {
    flowId,
    stepId,
    executionId,
    executionStep,
    computedParameters,
    nextStep,
  }
}
