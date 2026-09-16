import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import { validateFlowBlocks } from '@/apps/toolbox/common/validate-end-step'
import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import { getRepeatDelayedJobIds } from '@/helpers/repeatable-jobs'
import Flow from '@/models/flow'
import type Step from '@/models/step'
import flowQueue from '@/queues/flow'

const JOB_NAME = 'flow'
const EVERY_15_MINUTES_CRON = '*/15 * * * *'

export interface UpdateFlowStatusInput {
  flow: Flow
  active: boolean
  userId: string
  updatedAt?: string
}

const validateFlowSteps = (steps: Step[]) => {
  if (!steps.every((step, index) => step.position === index + 1)) {
    throw new Error('Step positions are out of order.')
  }

  const forEachSteps = steps.filter(
    (step) =>
      step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.FOR_EACH,
  )

  if (
    forEachSteps.length > 2 ||
    (forEachSteps.length === 2 &&
      forEachSteps[0].config.approval?.branch ===
        forEachSteps[1].config.approval?.branch)
  ) {
    throw new Error('Flow must have exactly one for-each step.')
  }
}

export async function updateFlowStatusService({
  flow,
  active,
  userId,
  updatedAt,
}: UpdateFlowStatusInput): Promise<Flow> {
  if (flow.active === active) {
    return flow
  }

  if (updatedAt !== undefined) {
    flow.assertNotUpdatedSince(updatedAt, userId)
  }

  if (active) {
    validateFlowSteps(flow.steps)
    validateFlowBlocks(flow.steps, flow.id)
  }

  const jobName = `${JOB_NAME}-${flow.id}`
  const triggerStep = await flow.getTriggerStep()
  const trigger = await triggerStep.getTriggerCommand()
  const interval = trigger.getInterval?.(triggerStep.parameters)
  const repeatOptions = {
    pattern: interval || EVERY_15_MINUTES_CRON,
    /**
     * BullMQ versions derive different repeat keys.
     *
     * A custom key lets upgrades and rollbacks remove the same job.
     */
    key: jobName,
  }

  /**
   * Queue failure must roll back the status change.
   */
  await Flow.transaction(async (trx) => {
    await flow.$query(trx).patch({
      active,
      publishedAt: active ? new Date().toISOString() : null,
      updatedBy: userId,
      config: {
        ...flow.config,
      },
    })

    if (trigger.type === 'webhook') {
      return
    }

    if (active) {
      await flowQueue.add(
        jobName,
        { flowId: flow.id },
        {
          repeat: repeatOptions,
          jobId: flow.id,
          removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
          removeOnFail: REMOVE_AFTER_30_DAYS,
        },
      )
      return
    }

    /**
     * @deprecated
     * Repeatable jobs are deprecated in favour of job schedulers.
     *
     * Prefix lookup works across the BullMQ key format change.
     */
    const repeatableJobs = await flowQueue.getRepeatableJobs()
    const job = repeatableJobs.find((job) => job.key.startsWith(jobName))
    if (!job) {
      logger.warn({
        message: `Bug: No repeatable job found for flow ${flow.id} when trying to remove repeatable job upon unpublishing.`,
        flowId: flow.id,
        jobName,
      })
      return
    }

    await flowQueue.removeRepeatableByKey(job.key)

    /**
     * Cleanup failure must not restore a published pipe without a schedule.
     */
    try {
      await flowQueue.remove(`repeat:${job.key}`)
      if (job.next) {
        const delayedJobIds = getRepeatDelayedJobIds({
          name: jobName,
          key: job.key,
          next: job.next,
          jobId: flow.id,
        })
        for (const delayedJobId of delayedJobIds) {
          await flowQueue.remove(delayedJobId)
        }
      }
    } catch (error) {
      logger.warn({
        message: 'Failed to clean leftover repeatable Redis keys after unpublish',
        flowId: flow.id,
        jobKey: job.key,
        error,
      })
    }
  })

  return flow
}
