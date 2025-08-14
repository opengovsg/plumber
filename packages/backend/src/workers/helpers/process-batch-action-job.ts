import {
  IActionJobData,
  IGlobalVariable,
  NextStepMetadata,
} from '@plumber/types'

import { Job, UnrecoverableError, WorkerPro } from '@taskforcesh/bullmq-pro'
import { tracer } from 'dd-trace'

import appConfig from '@/config/app'
import { ForEachContext } from '@/helpers/compute-for-each-parameters'
import Execution from '@/models/execution'
import Step from '@/models/step'
import { makeActionJobId } from '@/queues/action'
import {
  processJobAfterBatchFunction,
  processJobDataForBatchFunction,
} from '@/services/batch-action'

import { type BullMqOptions } from './make-action-worker'

type ProcessBatchActionJobOptions = {
  jobsInBatch: Job[]
  worker: WorkerPro<IActionJobData>
  bullMqOptions: BullMqOptions
  batchJobTimestamp: string
  batchFunction: (jobsToProcessData: ProcessedJobData[]) => Promise<void>
}

export type ProcessedJobData = {
  job: Job
  $: IGlobalVariable
  step: Step
  execution: Execution
  metadata: NextStepMetadata // not sure if this is needed
  forEachContext: ForEachContext
}

export const processBatchActionJob = async (
  params: ProcessBatchActionJobOptions,
) => {
  const {
    jobsInBatch,
    worker,
    bullMqOptions,
    batchJobTimestamp,
    batchFunction,
  } = params
  const { queueName } = bullMqOptions
  const span = tracer.scope().active()

  const jobsToProcessData: ProcessedJobData[] = []

  // Part 1: Pre-process the job data for the batch function
  for (const job of jobsInBatch) {
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
      batchJobTimestamp,
    })

    // pre-process the jobs to process data, job.setAsFailed() if necessary (this is the code before processAction in singleActionJob till the testRun function)
    await processJobDataForBatchFunction(
      job,
      jobsToProcessData,
      batchJobTimestamp,
    )
  }

  // Edge case where all jobs are failed to be processed, mark the batch job as failed
  if (jobsToProcessData.length === 0) {
    throw new UnrecoverableError('No jobs to process for batch function')
  }

  // Part 2: Perform the batch function on the remaining jobs
  // perform the batchFunction on the remaining jobs, store the error in the $ first.
  await batchFunction(jobsToProcessData)

  // Part 3: Post-process the batch function results: from "testRun" or "run" in singleActionJob
  // then use the error to populate the $.actionOutput.error for each job, and record the execution step... and return all the necessary data needed
  // then post-process with the necessary data after processAction in singleActionJob and job.setAsFailed() if necessary
  for (const jobToProcessData of jobsToProcessData) {
    await processJobAfterBatchFunction(
      jobToProcessData,
      batchJobTimestamp,
      worker,
      bullMqOptions,
    )
  }
}
