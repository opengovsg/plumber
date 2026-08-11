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
import Flow from '@/models/flow'
import flowQueue from '@/queues/flow'

import type { MutationResolvers, Step } from '../__generated__/types.generated'

const JOB_NAME = 'flow'
const EVERY_15_MINUTES_CRON = '*/15 * * * *'

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
    validateFlowBlocks(flow.steps, flow.id)
  }
  const jobName = `${JOB_NAME}-${flow.id}`

  const triggerStep = await flow.getTriggerStep()
  const trigger = await triggerStep.getTriggerCommand()
  const interval = trigger.getInterval?.(triggerStep.parameters)
  const repeatOptions = {
    pattern: interval || EVERY_15_MINUTES_CRON,
    /**
     * Why supply a custom repeat key instead of letting bullmq derive one?
     * The default repeat-zset member differs across the bullmq upgrade: 5.7.8
     * stores a readable concat (`flow-<id>:<id>:::<cron>`), while 5.70.2 stores
     * the md5 HASH of that concat. Supplying our own key makes both versions
     * store the job under a member we control (`flow-<id>`), so we can locate and
     * remove it by prefix on either version — including after rolling the server
     * back from 5.70.2 to 5.7.8.
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
         * Repeatable jobs and their helper functions are deprecated in favour of
         * job schedulers, but we are deferring that migration.
         *
         * We locate the repeatable job by its `flow-<id>` key prefix rather than
         * calling removeRepeatable(name, pattern, jobId): that helper reconstructs
         * the zset member using the *running* library's key algorithm, so it can't
         * find a job created under a different bullmq version. getRepeatableJobs()
         * + a prefix match works for both the old readable-concat member and our
         * custom-key member, so unpublish works across the 5.7.8 <-> 5.70.2
         * upgrade in BOTH directions (including a rollback).
         */
        const repeatableJobs = await flowQueue.getRepeatableJobs()
        const job = repeatableJobs.find((job) => job.key.startsWith(jobName))
        if (!job) {
          // No matching repeatable job: log a warning but allow the flow to be
          // unpublished (there is nothing left that could fire).
          logger.warn({
            message: `Bug: No repeatable job found for flow ${flow.id} when trying to remove repeatable job upon unpublishing.`,
            flowId: flow.id,
            jobName,
          })
        } else {
          /**
           * Removing a repeatable job takes three calls, not one, to fully
           * clean it up after a flow was published under bullmq 5.70.2 and
           * is being unpublished after a rollback to 5.7.8 (the version
           * installed here):
           *
           * 1. removeRepeatableByKey(job.key) removes the `repeat` zset
           *    entry, so no further occurrences get scheduled.
           * 2. remove(`repeat:${jobName}`) deletes a metadata hash that
           *    5.70.2 writes at Redis key `repeat:<key>` whenever the job
           *    is (re)added (it backs 5.70.2's getRepeatableJobs()
           *    name/pattern/tz enrichment). 5.70.2's own removeRepeatable
           *    script deletes this hash, but 5.7.8 has no notion of it and
           *    never cleans it up, so it's orphaned in Redis after a
           *    rollback unless removed explicitly. There's no dedicated
           *    helper for this — a job id happens to map to the same Redis
           *    key, so we (ab)use remove() here even though no job with
           *    this id was ever enqueued.
           * 3. remove(`repeat:${jobName}:${job.next}`) deletes the
           *    already-scheduled next-run delayed job. On 5.7.8,
           *    removeRepeatableByKey() recomputes this job's id by hashing
           *    job.key instead of using it directly, so it computes the
           *    wrong id and the real delayed job lingers. Both bullmq
           *    versions build the real id as `repeat:<our custom
           *    key>:<next-run millis>` when a custom repeat.key is
           *    supplied, so this id is stable across the upgrade.
           *
           * Verified against both versions' shipped Lua scripts and against
           * a real Redis instance: without calls 2 and 3, a flow published
           * under 5.70.2 and unpublished after rolling back to 5.7.8 leaves
           * both of these hashes behind in Redis forever.
           */
          await flowQueue.removeRepeatableByKey(job.key)
          await flowQueue.remove(`repeat:${jobName}`)
          if (job.next) {
            await flowQueue.remove(`repeat:${jobName}:${job.next}`)
          }
        }
      }
    }
  })

  return flow
}

export default updateFlowStatus
