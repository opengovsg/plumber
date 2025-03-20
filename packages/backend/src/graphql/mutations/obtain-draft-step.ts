import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const obtainDraftStep: MutationResolvers['obtainDraftStep'] = async (
  _parent,
  params,
  context,
) => {
  const { position, flowId } = params.input

  const flow = await context.currentUser
    .$relatedQuery('flows')
    .withGraphJoined('steps')
    .findOne({ 'flows.id': flowId })
    .throwIfNotFound()

  if (position > flow.steps.length + 1) {
    throw new Error('Draft position exceeds the last possible step in the flow')
  }

  const draftStep = await Step.query().findOne({
    position,
    flow_id: flowId,
    draft: true,
  })

  if (!draftStep) {
    // insert new draft step
    const newDraftStep = await Step.query().insert({
      position,
      draft: true,
      type: position === 1 ? 'trigger' : 'action',
      status: 'incomplete',
      parameters: {},
      flowId,
    })
    return newDraftStep
  }
  return draftStep
}

export default obtainDraftStep
