import { type IActionRunResult, NextStepMetadata } from '@plumber/types'

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
  metadata?: NextStepMetadata
}

export const processAction = async (options: ProcessActionOptions) => {
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
    logger.error(error)
    executionError = error
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
        $.actionOutput.error = {
          error: error.message,
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
    nextStepMetadata: runResult.nextStepMetadata,
    executionError,
  }
}
