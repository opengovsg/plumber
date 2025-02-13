import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import flowQueue from '@/queues/flow'

import type { MutationResolvers } from '../__generated__/types.generated'

const JOB_NAME = 'flow'
const EVERY_15_MINUTES_CRON = '*/15 * * * *'

const updateFlowStatus: MutationResolvers['updateFlowStatus'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
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

  // Check that step positions are contiguous when publishing
  if (
    params.input.active &&
    !flow.steps.every((step, index) => step.position === index + 1)
  ) {
    throw new Error(
      'Step positions are out of order. Please contact support@plumber.gov.sg for help.',
    )
  }

  await flow.$query().patch({
    active: params.input.active,
    publishedAt: params.input.active ? new Date().toISOString() : null,
  })

  const triggerStep = await flow.getTriggerStep()
  const trigger = await triggerStep.getTriggerCommand()
  const interval = trigger.getInterval?.(triggerStep.parameters)
  const repeatOptions = {
    pattern: interval || EVERY_15_MINUTES_CRON,
  }

  if (trigger.type !== 'webhook') {
    if (params.input.active) {
      const jobName = `${JOB_NAME}-${flow.id}`

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
      const repeatableJobs = await flowQueue.getRepeatableJobs()
      const job = repeatableJobs.find((job) => job.id === flow.id)

      await flowQueue.removeRepeatableByKey(job.key)
    }
  }

  return flow
}

export default updateFlowStatus
