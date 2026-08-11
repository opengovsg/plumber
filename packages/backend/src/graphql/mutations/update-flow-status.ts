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
           * Removing a repeatable job takes three steps, not one, because
           * neither bullmq version cleans up everything the other one wrote:
           *
           * 1. removeRepeatableByKey(job.key) removes the `repeat` zset
           *    entry, so no further occurrences get scheduled.
           * 2. remove(`repeat:${job.key}`) deletes a metadata hash that
           *    5.70.2 writes at Redis key `repeat:<member>` whenever the
           *    job is (re)added (it backs 5.70.2's getRepeatableJobs()
           *    name/pattern/tz enrichment). Nothing else deletes it: 5.7.8
           *    has no notion of it, and 5.70.2's own removeRepeatable Lua
           *    returns early from its legacy branch whenever the member is
           *    a concat, skipping its own DEL. There's no dedicated helper
           *    either — a job id happens to map to the same Redis key, so
           *    we (ab)use remove() here even though no job with this id
           *    was ever enqueued.
           * 3. Removing the already-scheduled next-run delayed job. Neither
           *    version's removeRepeatableByKey() derives that job's id
           *    correctly for an entry the *other* version wrote, so we
           *    derive every possible id ourselves.
           *
           * Verified against both versions' shipped Lua scripts and against
           * a real Redis instance: without steps 2 and 3, unpublishing after
           * an upgrade or a rollback leaves these keys behind forever.
           */
          await flowQueue.removeRepeatableByKey(job.key)
          // Steps 2 and 3 are leftover-key cleanup. If they throw after
          // removeRepeatableByKey succeeded, rolling back the DB patch
          // would leave a published pipe with no cron. Swallow and log
          // so the unpublish commits; the flow worker already no-ops
          // leftover delayed jobs when the pipe is inactive.
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
              message:
                'Failed to clean leftover repeatable Redis keys after unpublish',
              flowId: flow.id,
              jobKey: job.key,
              error,
            })
          }
        }
      }
    }
  })

  return flow
}

export default updateFlowStatus
