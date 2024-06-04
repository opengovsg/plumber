import makeFlowTemplate from '@/helpers/flow-templates'

import type { MutationResolvers } from '../__generated__/types.generated'

const createFlowTemplate: MutationResolvers['createFlowTemplate'] = async (
  _parent,
  params,
  context,
) => {
  const { flowName, trigger, actions, demoVideoDetails } = params.input
  return makeFlowTemplate(
    flowName,
    trigger,
    actions,
    context.currentUser,
    false,
    demoVideoDetails,
  )
}

export default createFlowTemplate
