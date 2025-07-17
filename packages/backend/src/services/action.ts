import { type IActionRunResult, TestRunStepMetadata } from '@plumber/types'

import {
  FOR_EACH_ITERATION_DELAY,
  FOR_EACH_MAX_ITERATIONS,
} from '@/apps/toolbox/common/constants'
import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import StepError from '@/errors/step'
import {
  ForEachContext,
  getStepContext,
} from '@/helpers/compute-for-each-parameters'
import computeParameters from '@/helpers/compute-parameters'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import { enqueueActionJob } from '@/queues/action'

import getForEachMetadata from './helpers/get-for-each-metadata'

type ProcessActionOptions = {
  flowId: string
  executionId: string
  stepId: string
  jobId?: string
  testRun?: boolean
  metadata?: TestRunStepMetadata
}

async function enqueueFirstForEachStep({
  iterations,
  firstStepInForEach,
  executionId,
  flowId,
  metadata,
}: {
  iterations: number
  firstStepInForEach: Step
  executionId: string
  flowId: string
  metadata?: TestRunStepMetadata
}): Promise<void> {
  // remove unnecessary metadata from steps within the for-each
  const filteredMetadata = { ...metadata }
  delete filteredMetadata?.iterations
  delete filteredMetadata?.iterationStatus

  const results = await Promise.allSettled(
    Array.from({ length: iterations }, (_, i) =>
      enqueueActionJob({
        appKey: firstStepInForEach.appKey,
        jobName: `${executionId}-${firstStepInForEach.id}-${i + 1}`,
        jobData: {
          flowId: flowId,
          executionId: executionId,
          stepId: firstStepInForEach.id,
          metadata: {
            ...filteredMetadata,
            iteration: i + 1,
            ...(i === iterations - 1 && { isLastIteration: true }),
          },
        },
        jobOptions: {
          ...DEFAULT_JOB_OPTIONS,
          delay: i * FOR_EACH_ITERATION_DELAY,
        },
      }),
    ),
  )

  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    logger.error(`Failed to enqueue ${failures.length} for-each jobs`, {
      failures,
    })
  }
}

export const processAction = async (options: ProcessActionOptions) => {
  const {
    flowId,
    stepId,
    executionId,
    jobId,
    testRun = false,
    metadata = {},
  } = options

  const step = await Step.query().findById(stepId).throwIfNotFound()
  const flow = await Flow.query()
    .findById(flowId)
    .withGraphJoined('user')
    .withGraphFetched('steps')
    .throwIfNotFound()
  const execution = await Execution.query()
    .findById(executionId)
    .throwIfNotFound()

  const { forEachStepPosition, stepPositions, isForEachStep, isLastStep } =
    getStepContext(flow, step)

  // we use this to indicate an iteration in the for-each is complete
  if (!testRun && forEachStepPosition > -1 && isLastStep && metadata) {
    metadata.isLastStep = true
  }

  const $ = await globalVariable({
    flow,
    app: await step.getApp(),
    step: step,
    connection: await step.$relatedQuery('connection'),
    execution: execution,
    testRun,
    metadata,
  })

  const priorExecutionSteps = await ExecutionStep.query().where({
    execution_id: $.execution.id,
    // only get successful execution steps
    status: 'success',
  })

  const actionCommand = await step.getActionCommand()
  const forEachContext: ForEachContext = {
    executionStepMetadata: metadata,
    forEachStepPosition,
    stepPositions,
    isForEachStep,
  }

  const computedParameters = computeParameters(
    $.step.parameters,
    priorExecutionSteps,
    actionCommand.preprocessVariable,
    forEachContext,
  )

  $.step.parameters = computedParameters

  let runResult: IActionRunResult = {}
  let executionError: unknown = null
  try {
    // Cannot assign directly to runResult due to void return type.
    const result =
      testRun && actionCommand.testRun
        ? await actionCommand.testRun($, metadata)
        : await actionCommand.run($, metadata)
    if (result) {
      runResult = result
    }
  } catch (error) {
    executionError = error

    logger.error(error)
    // log raw http error from StepError
    if (error instanceof StepError && error.cause) {
      logger.error(error.cause)
    }
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

  /**
   * During non-test runs and the error is a PartialStepError, we want to mark the step as successful
   * so it continues to the next step
   */
  const status: ExecutionStep['status'] =
    !executionError || (!testRun && executionError instanceof PartialStepError)
      ? 'success'
      : 'failure'

  // update metadata specially for for-each
  if (!testRun) {
    getForEachMetadata({
      forEachContext,
      metadata,
      dataOut: $.actionOutput.data?.raw ?? null,
      runResult,
    })
  }

  const executionStep = await execution
    .$relatedQuery('executionSteps')
    .insertAndFetch({
      stepId: $.step.id,
      status,
      dataIn: computedParameters,
      dataOut: $.actionOutput.data?.raw ?? null,
      errorDetails: $.actionOutput.error ?? null,
      appKey: $.app.key,
      jobId,
      key: step.key,
      metadata,
    })

  let nextStep = null
  switch (runResult.nextStep?.command) {
    case 'jump-to-step':
      nextStep = await flow
        .$relatedQuery('steps')
        .findById(runResult.nextStep.stepId)
        .throwIfNotFound()
      break

    case 'start-for-each': {
      /**
       * FOR-EACH:
       * we do not have a next step because we enqueue the next step here
       * each iteration of the for-each step will have its own job.
       * we also intentionally add a delay between each iteration to avoid
       * overwhelming the workers.
       */
      nextStep = null
      const dataOut = $.actionOutput.data?.raw ?? null
      const iterations = Math.min(
        FOR_EACH_MAX_ITERATIONS,
        Number(dataOut?.iterations ?? 0),
      )

      // NOTE: unlikely that iterations will be negative, but just in case
      if (!iterations || iterations <= 0) {
        break
      }

      const firstStepInForEach = await step.getNextStep()

      // testing for-each step should not enqueue any jobs
      if (!testRun && firstStepInForEach) {
        await enqueueFirstForEachStep({
          iterations,
          firstStepInForEach,
          executionId,
          flowId,
          metadata,
        })
      }

      break
    }
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
    nextStepMetadata: {
      ...runResult.nextStepMetadata,
      ...metadata,
    },
    executionError,
  }
}
