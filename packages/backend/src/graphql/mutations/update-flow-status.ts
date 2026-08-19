import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import {
  addFlowRepeatableJob,
  removeFlowRepeatableJobs,
} from '@/queues/helpers/flow-repeatable-jobs'

import type { MutationResolvers, Step } from '../__generated__/types.generated'

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
  }

  await flow.$query().patch({
    active: params.input.active,
    publishedAt: params.input.active ? new Date().toISOString() : null,
    updatedBy: context.currentUser.id,
    config: {
      ...flow.config,
    },
  })

  const triggerStep = await flow.getTriggerStep()
  const trigger = await triggerStep.getTriggerCommand()
  const interval = trigger.getInterval?.(triggerStep.parameters)
  const repeatOptions = {
    pattern: interval || EVERY_15_MINUTES_CRON,
  }

  if (trigger.type !== 'webhook') {
    if (params.input.active) {
      await addFlowRepeatableJob(flow.id, repeatOptions.pattern)
    } else {
      await removeFlowRepeatableJobs(flow.id)
    }
  }

  return flow
}

export default updateFlowStatus
