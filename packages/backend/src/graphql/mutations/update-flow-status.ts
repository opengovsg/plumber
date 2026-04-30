import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import flowQueue from '@/queues/flow'

import type { MutationResolvers, Step } from '../__generated__/types.generated'

const JOB_NAME = 'flow'
const EVERY_15_MINUTES_CRON = '*/15 * * * *'

const validateFlowSteps = (steps: Step[]) => {
  if (!steps.every((step, index) => step.position === index + 1)) {
    throw new Error(
      'Step positions are out of order. Please contact support@plumber.gov.sg for help.',
    )
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
    throw new Error(
      'Flow must have exactly one for-each step. Please contact support@plumber.gov.sg for help.',
    )
  }
}

const updateFlowStatus: MutationResolvers['updateFlowStatus'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      'flows.id': params.input.id,
    })
    .withGraphJoined('steps')
    .orderBy('steps.position', 'asc')
    .throwIfNotFound()

  // Do nothing if status did not change
  if (flow.active === params.input.active) {
    return flow
  }

  flow.assertNotUpdatedSince(params.input.updatedAt, context.currentUser.id)

  if (params.input.active) {
    validateFlowSteps(flow.steps)
  }
  const jobName = `${JOB_NAME}-${flow.id}`

  const triggerStep = await flow.getTriggerStep()
  const trigger = await triggerStep.getTriggerCommand()
  const interval = trigger.getInterval?.(triggerStep.parameters)
  const repeatOptions = {
    pattern: interval || EVERY_15_MINUTES_CRON,
    /**
     * Why use a custom repeatable key instead of the default one that bullmq generates?
     * The old key was a concatenation of job name, job  id, tz(empty), and cron pattern. (i.e. flow-${flow.id}:${flow.id}:::0 * * * *)
     * However, the new version of bullmq (latest v5) hashes the concatenated string, making it hard to derive or compare (i.e. abcdef123123123)
     * Therefore, we are supplying our own repeatable key so we can identify both new and old repeatable jobs by their prefix (i.e. flow-${flow.id})
     */
    key: jobName,
  }

  /**
   * Patch first inside the transaction, then perform the queue op.
   * If the queue add/remove fails, the patch is rolled back so the flow's
   * active state stays consistent (best-effort) with whether
   * the repeatable job exists.
   */
  await Flow.transaction(async (trx) => {
    await flow.$query(trx).patch({
      active: params.input.active,
      publishedAt: params.input.active ? new Date().toISOString() : null,
      updatedBy: context.currentUser.id,
      config: {
        ...flow.config,
      },
    })

    if (trigger.type !== 'webhook') {
      if (params.input.active) {
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
      } else {
        /**
         * @deprecated
         * Repeatable jobs and its helper functions are now deprecated in favour of job schedulers.
         * But deferring this change since this requires a migration of existing repeatable jobs
         */
        const repeatableJobs = await flowQueue.getRepeatableJobs()
        const job = repeatableJobs.find((job) => job.key.startsWith(jobName))
        // If no job found, we log a warning, but allow the flow to be unpublished.
        if (!job) {
          logger.warn({
            message: `Bug: No repeatable job found for flow ${flow.id} when trying to remove repeatable job upon unpublishing.`,
            flowId: flow.id,
            jobName,
          })
        } else {
          await flowQueue.removeRepeatableByKey(job.key)
        }
      }
    }
  })

  return flow
}

export default updateFlowStatus
