import { NotFoundError } from 'objection'

import Step from '@/models/step'
import { loadAccessibleStep } from '@/services/access'
import { runStepTest } from '@/services/run-step-test'

import type { MutationResolvers } from '../__generated__/types.generated'

const executeStep: MutationResolvers['executeStep'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId, testRunMetadata } = params.input

  const step = await loadAccessibleStep({
    user: context.currentUser,
    stepId,
    role: 'editor',
    graph: 'flow',
  })

  if (!step) {
    throw new NotFoundError({ modelClass: Step })
  }

  const { executionStep } = await runStepTest({
    step,
    testRunMetadata,
  })

  return executionStep
}

export default executeStep
