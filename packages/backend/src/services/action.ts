import { IStep } from '@plumber/types'

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
}

export const processAction = async (options: ProcessActionOptions) => {
  const { flowId, stepId, executionId, jobId } = options

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

  // This is a tri-state variable with the following possible values:
  // * undefined = Go to default next step (i.e. step position + 1)
  // * null = Stop flow execution
  // * concrete value = Go to step with ID equal to this value.
  let nextStepId: IStep['id'] | null | undefined = undefined
  try {
    await actionCommand.run($, (stepIdToRedirectTo: IStep['id'] | null) => {
      nextStepId = stepIdToRedirectTo ?? null // Force undefined to null... just in case.

      if (stepIdToRedirectTo) {
        logger.info(
          `Step ${stepId} redirected flow execution to step ID ${stepIdToRedirectTo}.`,
          {
            event: 'step-redirected-flow-execution',
            executionId,
            stepId,
            flowId,
            stepIdToRedirectTo,
          },
        )
      } else {
        logger.info(`Step ${stepId} stopped flow execution.`, {
          event: 'step-stopped-flow-execution',
          executionId,
          stepId,
          flowId,
        })
      }
    })
  } catch (error) {
    logger.error(error)
    if (error instanceof HttpError) {
      $.actionOutput.error = {
        details: error.details,
        status: error.response.status,
        statusText: error.response.statusText,
      }
    } else if (error instanceof CancelFlowError) {
      nextStepId = null
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

  let nextStep = null
  if (nextStepId === undefined) {
    nextStep = await step.getNextStep()
  } else if (nextStepId !== null) {
    nextStep = await flow
      .$relatedQuery('steps')
      .findById(nextStepId)
      .throwIfNotFound()
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
