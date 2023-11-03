import { raw } from 'objection'

import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'
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

  const previousSteps = await Step.query()
    .select('*')
    .where('flow_id', '=', step.flowId)
    .where('position', '<', step.position)
    .orderBy('position', 'asc')

  if (previousSteps.length === 0) {
    return []
  }

  const latestExecutionSteps = await ExecutionStep.query()
    .with('latest_execution_steps', (builder) => {
      builder
        .select(
          '*',
          raw(
            'ROW_NUMBER() OVER (PARTITION BY step_id ORDER BY created_at DESC) as rn',
          ),
        )
        .from('execution_steps')
        .whereIn('step_id', [...previousSteps.map((step) => step.id), step.id])
    })
    .select('*')
    .from('latest_execution_steps')
    .where('rn', '=', 1)
    .withSoftDeleted()
    .debug()

  previousSteps.map((previousStep) => {
    previousStep.executionSteps = []
    const latestExecustionStep = latestExecutionSteps.find(
      (latestExecutionStep) => latestExecutionStep.stepId === previousStep.id,
    )
    if (latestExecustionStep) {
      previousStep.executionSteps.push(latestExecustionStep)
    }
  })

  return previousSteps
}

export default getStepWithTestExecutions
