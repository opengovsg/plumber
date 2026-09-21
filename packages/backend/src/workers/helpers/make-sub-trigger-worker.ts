import type { IActionJobData, IActionRunResult } from '@plumber/types'

import {
  UnrecoverableError,
  WorkerPro,
  WorkerProOptions,
} from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import HttpError from '@/errors/http'
import { exponentialBackoffWithJitter } from '@/helpers/backoff'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'

import { claimSubTriggerAndEnqueueNext } from './claim-sub-trigger-and-enqueue-next'
import { getJobQueueTimingTags } from './job-queue-timing'
import { registerWorkerEventHandlers } from './worker-event-handlers'

interface MakeSubTriggerWorkerParams {
  appKey: string
  queueName: string
}

const defaultWorkerOptions: WorkerProOptions = {
  connection: createRedisClient(),
  concurrency: appConfig.workerActionConcurrency,
  removeOnComplete: {
    age: 0,
    count: 0,
  },
  settings: {
    backoffStrategy: exponentialBackoffWithJitter,
  },
}

/**
 * Sub-trigger workers listens to the same queue as actions but with some differences
 * 1. Worker will not create a new execution step for the sub-trigger, this is done by webhook handlers
 * 2. It will not need to use computeParameters since it does not rely on previous execution steps
 * 3. It handles a new kind of command "pause-execution", which is essentially a no-op
 * 4. It does not enqueue delayed actions
 * 5. It does not handle "for-each" commands
 */
export function makeSubTriggerWorker(
  params: MakeSubTriggerWorkerParams,
): WorkerPro<IActionJobData> {
  const { queueName } = params
  const worker: WorkerPro<IActionJobData> = new WorkerPro<IActionJobData>(
    queueName,
    tracer.wrap('workers.subtrigger', async (job) => {
      const span = tracer.scope().active()
      const jobData = job.data
      const { flowId, executionId, stepId, metadata } = jobData

      const step = await Step.query().findById(stepId).throwIfNotFound()
      const flow = await Flow.query()
        .findById(flowId)
        .withGraphJoined('user')
        .withGraphFetched('steps')
        .throwIfNotFound()
      const execution = await Execution.query()
        .findById(executionId)
        .throwIfNotFound()

      span?.addTags({
        queueName,
        flowId,
        executionId: jobData.executionId,
        stepId: jobData.stepId,
        actionKey: step?.key,
        appKey: step?.appKey,
        ...getJobQueueTimingTags(job),
        workerVersion: appConfig.version,
      })

      const $ = await globalVariable({
        flow,
        app: await step.getApp(),
        step,
        connection: await step.$relatedQuery('connection'),
        execution,
        testRun: false,
        metadata: jobData.metadata ?? {},
      })

      const actionCommand = await step.getActionCommand()

      try {
        const runResult = ((await actionCommand.run($, metadata)) ??
          {}) as IActionRunResult

        const jobName = `${executionId}-${step.id}`

        let nextStep: Step | null = null
        const nextStepCommand = runResult?.nextStep?.command
        switch (nextStepCommand) {
          case 'jump-to-step':
            nextStep = await flow
              .$relatedQuery('steps')
              .findById(runResult.nextStep.stepId)
              .throwIfNotFound()
            break
          case 'pause-execution':
            // we do nothing here
            return
          case 'stop-execution':
            // nextStep is already null
            break
          case 'start-for-each':
            logger.error({
              event: 'invalid-subtrigger-command',
              command: nextStepCommand,
              stepId,
              flowId,
              executionId,
            })
            throw new UnrecoverableError(
              `start-for-each command not allowed for sub-triggers`,
            )
          default:
            nextStep = await step.getNextStep()
        }

        if (!nextStep) {
          await Execution.setStatus(executionId, 'success')
          return
        }

        await claimSubTriggerAndEnqueueNext({
          executionId: $.execution.id,
          stepId: $.step.id,
          nextStep,
          jobName,
          jobPayload: {
            flowId,
            executionId,
            stepId: nextStep.id,
            metadata: runResult.nextStepMetadata,
          },
        })
      } catch (error) {
        if (error instanceof HttpError) {
          $.actionOutput.error = {
            details: error.details,
            status: error.response.status,
            statusText: error.response.statusText,
          }
          logger.error('[sub-trigger] error', {
            details: error.details,
            status: error.response.status,
            statusText: error.response.statusText,
          })
        } else {
          try {
            const parsedError = JSON.parse(error.message)
            $.actionOutput.error = parsedError
            logger.error('[sub-trigger] error', parsedError)
          } catch {
            $.actionOutput.error = { error: error.message }
            logger.error('[sub-trigger] error', { error: error.message })
          }
        }
        throw new UnrecoverableError(error.message)
      }
    }),
    defaultWorkerOptions,
  )

  registerWorkerEventHandlers(worker, queueName)

  return worker
}
