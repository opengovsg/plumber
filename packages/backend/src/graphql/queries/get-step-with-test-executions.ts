import { raw } from 'objection'

import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'

import type { QueryResolvers } from '../__generated__/types.generated'

const getStepWithTestExecutions: QueryResolvers['getStepWithTestExecutions'] =
  async (_parent, params, context) => {
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
          .whereIn(
            'step_id',
            previousSteps.map((step) => step.id),
          )
          .andWhere('status', '=', 'success')
      })
      .select('*')
      .from('latest_execution_steps')
      .where('rn', '=', 1)
      .withSoftDeleted()

    previousSteps.map((previousStep) => {
      previousStep.executionSteps = []
      const latestExecutionStep = latestExecutionSteps.find(
        (latestExecutionStep) => latestExecutionStep.stepId === previousStep.id,
      )
      if (latestExecutionStep) {
        previousStep.executionSteps.push(latestExecutionStep)
      }
    })

    return previousSteps
  }

export default getStepWithTestExecutions
