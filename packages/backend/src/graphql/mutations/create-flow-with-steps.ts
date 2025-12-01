import Flow from '@/models/flow'

import { MutationResolvers, StepInput } from '../__generated__/types.generated'

const createFlowWithSteps: MutationResolvers['createFlowWithSteps'] = async (
  _parent,
  params,
  context,
) => {
  const {
    input: { steps, flowName, traceId },
  } = params

  const trimmedFlowName = flowName.trim()
  if (trimmedFlowName === '') {
    throw new Error('Pipe name needs to have at least 1 character.')
  }

  if (
    !steps.every((step, index) => {
      // positions must always start at 1
      // and must be contiguous
      if (index === 0) {
        return step.position === 1
      }
      return step.position === steps[index - 1].position + 1
    })
  ) {
    throw new Error('Must be contiguous steps!')
  }

  const triggerStep = steps.find((step) => step.position === 1)
  if (!triggerStep || triggerStep.type !== 'trigger') {
    throw new Error('Pipe must always start with a trigger')
  }

  const nonTriggerSteps = steps.filter((step) => step.position > 1)
  if (nonTriggerSteps.some((step) => step.type !== 'action')) {
    throw new Error('Pipe contains more than one trigger')
  }

  return Flow.transaction(async (trx) => {
    const flow = await context.currentUser.$relatedQuery('flows', trx).insert({
      name: trimmedFlowName,
      config: {
        aiBuilder: true,
        aiBuilderTraceId: traceId,
      },
    })

    const stepsToInsert = steps.map((step: StepInput) => {
      // add a check that if step.appKey === 'toolbox', it should have step.parameters with depth and branchname
      if (
        step.key === 'ifThen' &&
        (step.parameters?.depth == null || step.parameters?.branchName == null)
      ) {
        throw new Error('If-then step must have depth and branch parameters')
      }

      return {
        type: step.type,
        appKey: step.appKey,
        key: step.key,
        config: step?.config || {},
        parameters: step?.parameters || {},
        position: step.position,
      }
    })

    await flow.$relatedQuery('steps', trx).insert(stepsToInsert)

    return flow
  })
}

export default createFlowWithSteps
