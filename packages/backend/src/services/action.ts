import { type IActionRunResult, NextStepMetadata } from '@plumber/types'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'
import computeParameters from '@/helpers/compute-parameters'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'

interface ProcessActionOptions {
  flowId: string
  executionId: string
  stepId: string
  jobId?: string
  testRun?: boolean
  metadata?: NextStepMetadata
}

interface NextStepInfo {
  step: Step
  metadata?: NextStepMetadata
}

interface ExecutionInfo {
  execution: Execution
  executionStep: ExecutionStep
  error?: unknown // could be any thrown error.
}

interface ProcessActionResult {
  flowId: Flow['id']
  stepId: Step['id']
  executionInfo: ExecutionInfo

  /**
   * This is null if there is no next step and pipe should terminate.
   */
  nextStepInfo: NextStepInfo | null
}

export const processAction = async (
  options: ProcessActionOptions,
): Promise<ProcessActionResult> => {
  const {
    flowId,
    stepId,
    executionId,
    jobId,
    testRun = false,
    metadata,
  } = options

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

  // Determine and fill up info for next step if needed.
  let nextStep: Step | null = null
  switch (runResult.nextStep?.command) {
    case 'jump-to-step':
      nextStep = await flow
        .$relatedQuery('steps')
        .findById(runResult.nextStep.stepId)
        .throwIfNotFound()
      break
    case 'stop-execution':
      // Nothing to do, nextStepInfo is already null.
      break
    default:
      nextStep = await step.getNextStep()
  }

  const nextStepInfo: NextStepInfo | null = nextStep
    ? {
        step: nextStep,
        metadata: runResult.nextStepMetadata,
      }
    : null

  return {
    flowId,
    stepId,
    executionInfo: {
      execution,
      executionStep,
      error: executionError,
    },
    nextStepInfo,
  }
}
