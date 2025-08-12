import { IActionJobData } from '@plumber/types'

import { Job, UnrecoverableError, WorkerPro } from '@taskforcesh/bullmq-pro'
import { tracer } from 'dd-trace'

import appConfig from '@/config/app'
import { handleFailedStepAndThrow } from '@/helpers/actions'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import delayAsMilliseconds from '@/helpers/delay-as-milliseconds'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'
import { enqueueActionJob, makeActionJobId } from '@/queues/action'
import { processAction } from '@/services/action'

import processForEachStatus from './for-each-status-manager'
import { type BullMqOptions } from './make-action-worker'

export const processSingleActionJob = async (
  job: Job,
  worker: WorkerPro<IActionJobData>,
  bullMqOptions: BullMqOptions,
) => {
  const { queueName, isQueueDelayable } = bullMqOptions
  const span = tracer.scope().active()
  const jobData = job.data
  const jobId = makeActionJobId(queueName, job.id)

  // The reason why we dont add .throwIfNotFound() here is to prevent job
  // retries delegating the error throwing and handling to processAction
  // where it also queries for Step.
  const currStep = await Step.query().findById(jobData.stepId)

  span?.addTags({
    queueName,
    flowId: jobData.flowId,
    executionId: jobData.executionId,
    stepId: jobData.stepId,
    actionKey: currStep?.key,
    appKey: currStep?.appKey,
    jobId,
    jobEnqueueTime: job.timestamp,
    jobDelay: job.opts?.delay ?? 0,
    attempts: job.attemptsStarted,
    timeInJobQueue: Date.now() - job.timestamp - (job.opts?.delay ?? 0),
    workerVersion: appConfig.version,
  })

  const {
    flowId,
    executionId,
    nextStep,
    executionStep,
    nextStepMetadata,
    executionError,
  } = await processAction({ ...jobData, jobId }).catch(async (err) => {
    // This happens when the prerequisite steps for the action fails (e.g.
    // db error, missing execution, flow, step, etc...) in such cases, we
    // do not want to retry
    throw new UnrecoverableError(err.message || 'Action failed to execute')
  })

  if (executionStep.isFailed) {
    if (nextStepMetadata?.iteration) {
      await ExecutionStep.patchIterationStatus(
        executionId,
        nextStepMetadata.iteration,
        'failure',
      )
    }
    return handleFailedStepAndThrow({
      errorDetails: executionStep.errorDetails,
      executionError,
      context: {
        isQueueDelayable,
        worker,
        span,
        job,
      },
    })
  }

  if (!nextStep) {
    const shouldContinue = await processForEachStatus({
      executionId,
      currStep,
      nextStepMetadata,
    })

    if (!shouldContinue) {
      return
    }

    await Execution.setStatus(executionId, 'success')
    return
  }

  const jobName = `${executionId}-${nextStep.id}`

  const jobPayload: IActionJobData = {
    flowId,
    executionId,
    stepId: nextStep.id,
    metadata: nextStepMetadata,
  }

  let jobOptions = DEFAULT_JOB_OPTIONS

  if (currStep.appKey === 'delay') {
    jobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      delay: delayAsMilliseconds(currStep.key, executionStep.dataOut),
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
}
