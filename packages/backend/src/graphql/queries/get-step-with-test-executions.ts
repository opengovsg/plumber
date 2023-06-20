import { ref } from 'objection'

import ExecutionStep from '@/models/execution-step'
import Context from '@/types/express/context'

type Params = {
  stepId: string
}

const getStepWithTestExecutions = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const step = await context.currentUser
    .$relatedQuery('steps')
    .findOne({ 'steps.id': params.stepId })
    .throwIfNotFound()

  const previousStepsWithCurrentStep = await context.currentUser
    .$relatedQuery('steps')
    .withGraphJoined('executionSteps')
    .where('flow_id', '=', step.flowId)
    .andWhere('position', '<', step.position)
    .andWhere(
      'executionSteps.created_at',
      '=',
      ExecutionStep.query()
        .max('created_at')
        .where('step_id', '=', ref('steps.id'))
        .andWhere('status', 'success'),
    )
    .orderBy('steps.position', 'asc')

  return previousStepsWithCurrentStep
}

export default getStepWithTestExecutions
