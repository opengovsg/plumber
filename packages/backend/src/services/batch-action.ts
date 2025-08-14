import {
  IActionJobData,
  IActionRunResult,
  NextStepMetadata,
  type TestRunStepMetadata,
} from '@plumber/types'

import { Job, UnrecoverableError, WorkerPro } from '@taskforcesh/bullmq-pro'
import { tracer } from 'dd-trace'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'
import { handleFailedStepAndThrow } from '@/helpers/actions'
import {
  ForEachContext,
  getStepContext,
} from '@/helpers/compute-for-each-parameters'
import computeParameters from '@/helpers/compute-parameters'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import delayAsMilliseconds from '@/helpers/delay-as-milliseconds'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import { enqueueActionJob, makeActionJobId } from '@/queues/action'
import processForEachStatus from '@/workers/helpers/for-each-status-manager'
import { BullMqOptions } from '@/workers/helpers/make-action-worker'
import { type ProcessedJobData } from '@/workers/helpers/process-batch-action-job'

import getForEachMetadata from './helpers/get-for-each-metadata'

export type ProcessBatchActionOptions = {
  flowId: string
  executionId: string
  stepId: string
  jobId?: string
  testRun?: boolean
  metadata?: TestRunStepMetadata
}

export type BatchJobResult = {
  jobData: ProcessBatchActionOptions
  success: boolean
  executionStep?: ExecutionStep
  error?: unknown
}

/**
 * This function is used to generate the error for the action output which will be stored in the $.actionOutput.error. This is to avoid the job failing before marking it as failed on the DB.
 */
export const generateErrorForActionOutput = (error: Error) => {
  logger.error(error)
  // log raw http error from StepError
  if (error instanceof StepError && error.cause) {
    logger.error(error.cause)
  }
  if (error instanceof HttpError) {
    return {
      details: error.details,
      status: error.response.status,
      statusText: error.response.statusText,
    }
  } else {
    try {
      return JSON.parse(error.message)
    } catch {
      return { error: error.message }
    }
  }
}

/**
 * This function is used to pre-process the job data to prepare for the batchFunction
 * It will mark the job as failed if the job data cannot be processed. Else, it will add the job to the jobsToProcessData array.
 *
 * For db error, missing execution, flow, step, etc..., we do not want to retry and process these jobs
 */
export const processJobDataForBatchFunction = async (
  job: Job,
  jobsToProcessData: ProcessedJobData[],
  batchJobTimestamp: string,
): Promise<void> => {
  const { flowId, executionId, stepId, metadata = {} } = job.data

  try {
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
    if (forEachStepPosition > -1 && isLastStep && metadata) {
      metadata.isLastStep = true
    }

    // Only initialise $ global variable once for running batch job action later
    const $ = await globalVariable({
      flow,
      app: await step.getApp(),
      step: step,
      connection: await step.$relatedQuery('connection'),
      execution: execution,
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

    jobsToProcessData.push({
      job,
      $,
      step,
      execution,
      metadata,
      forEachContext,
    })
  } catch (error) {
    // don't process this job, mark it as failed and move on to the next job
    logger.error(`Failed to process job in batch`, {
      error,
      executionId,
      stepId,
      flowId,
      jobId: job.id,
      batchJobTimestamp,
    })
    const unrecoverableError = new UnrecoverableError(
      error.message || 'Action failed to execute',
    )
    job.updateProgress(unrecoverableError)
    job.setAsFailed(unrecoverableError)
  }
}

// Will never be a test run...
export const processJobAfterBatchFunction = async (
  jobToProcessData: ProcessedJobData,
  batchJobTimestamp: string,
  worker: WorkerPro<IActionJobData>,
  bullMqOptions: BullMqOptions,
) => {
  const { job, $, step, execution, metadata, forEachContext } = jobToProcessData
  try {
    const span = tracer.scope().active()
    const { queueName, isQueueDelayable } = bullMqOptions
    const jobId = makeActionJobId(queueName, job.id)

    const runResult: IActionRunResult = {} // this will be empty unless the batched job contains onlyContinueIf, forEach or ifThen

    // No need for checking for PartialStepError?
    /**
     * During non-test runs and the error is a PartialStepError, we want to mark the step as successful
     * so it continues to the next step
     */
    const status: ExecutionStep['status'] = $.actionOutput.error
      ? 'failure'
      : 'success'

    // update metadata specially for for-each: TODO: check if this is needed
    getForEachMetadata({
      forEachContext,
      metadata,
      dataOut: $.actionOutput.data?.raw ?? null,
      runResult,
    })

    const updatedMetadata: NextStepMetadata = {
      ...metadata,
      batchJobTimestamp,
    }

    const executionStep = await execution
      .$relatedQuery('executionSteps')
      .insertAndFetch({
        stepId: $.step.id,
        status,
        dataIn: $.step.parameters, // This is the computed parameters
        dataOut: $.actionOutput.data?.raw ?? null,
        errorDetails: $.actionOutput.error ?? null,
        appKey: $.app.key,
        jobId,
        key: step.key,
        metadata: updatedMetadata,
      })

    // No need to check for next step because should not have onlyContinueIf, forEach or ifThen
    const nextStep = await step.getNextStep()
    const nextStepMetadata = {
      ...runResult.nextStepMetadata,
      ...updatedMetadata,
    }

    // After processing the batch function, we need to do the post processing similar to a single action job
    if (executionStep.isFailed) {
      if (nextStepMetadata?.iteration) {
        await ExecutionStep.patchIterationStatus(
          execution.id,
          nextStepMetadata.iteration,
          'failure',
        )
      }
      return handleFailedStepAndThrow({
        errorDetails: executionStep.errorDetails,
        executionError: $.executionError,
        context: {
          isQueueDelayable,
          worker,
          span,
          job,
        },
      })
    }

    // Similar to single action job code...
    if (!nextStep) {
      const shouldContinue = await processForEachStatus({
        executionId: execution.id,
        currStep: step,
        nextStepMetadata,
      })

      if (!shouldContinue) {
        return
      }

      await Execution.setStatus(execution.id, 'success')
      return
    }

    const jobName = `${execution.id}-${nextStep.id}`

    const jobPayload: IActionJobData = {
      flowId: execution.flowId,
      executionId: execution.id,
      stepId: nextStep.id,
      metadata: nextStepMetadata,
    }

    let jobOptions = DEFAULT_JOB_OPTIONS

    if (step.appKey === 'delay') {
      jobOptions = {
        ...DEFAULT_JOB_OPTIONS,
        delay: delayAsMilliseconds(step.key, executionStep.dataOut),
      }
    }

    try {
      await enqueueActionJob({
        appKey: nextStep.appKey,
        jobName,
        jobData: jobPayload,
        jobOptions,
      })
    } catch (error) {
      // Don't retry if we failed to enqueue the next step (e.g. if
      // getGroupConfigForJob throws an error)
      throw new UnrecoverableError(error.message)
    }
  } catch (error) {
    // don't process this job, mark it as failed and move on to the next job
    logger.error(`Failed to process job after batch function results`, {
      error,
      executionId: execution.id,
      stepId: step.id,
      flowId: execution.flowId,
      jobId: job.id,
      batchJobTimestamp,
    })
    job.updateProgress(error)
    job.setAsFailed(error)
  }
}
