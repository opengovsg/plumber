import CancelFlowError from '../errors/cancel-flow'
import HttpError from '../errors/http'
import computeParameters from '../helpers/compute-parameters'
import globalVariable from '../helpers/global-variable'
import logger from '../helpers/logger'
import Execution from '../models/execution'
import ExecutionStep from '../models/execution-step'
import Flow from '../models/flow'
import Step from '../models/step'

type ProcessActionOptions = {
  flowId: string
  executionId: string
  stepId: string
  jobId?: string
}

export const processAction = async (options: ProcessActionOptions) => {
  const { flowId, stepId, executionId, jobId } = options

  const step = await Step.query().findById(stepId).throwIfNotFound()
  const execution = await Execution.query()
    .findById(executionId)
    .throwIfNotFound()

  const $ = await globalVariable({
    flow: await Flow.query().findById(flowId).throwIfNotFound(),
    app: await step.getApp(),
    step: step,
    connection: await step.$relatedQuery('connection'),
    execution: execution,
  })

  const priorExecutionSteps = await ExecutionStep.query().where({
    execution_id: $.execution.id,
    // only get successful execution steps
    status: 'success',
  })

  const computedParameters = computeParameters(
    $.step.parameters,
    priorExecutionSteps,
  )

  const actionCommand = await step.getActionCommand()

  $.step.parameters = computedParameters

  let proceedToNextAction = true
  try {
    await actionCommand.run($)
  } catch (error) {
    logger.error(error)
    if (error instanceof HttpError) {
      $.actionOutput.error = {
        details: error.details,
        status: error.response.status,
        statusText: error.response.statusText,
      }
    } else if (error instanceof CancelFlowError) {
      proceedToNextAction = false
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

  return {
    flowId,
    stepId,
    executionId,
    executionStep,
    proceedToNextAction,
    computedParameters,
  }
}
