import createFlowFromTemplate from '@/helpers/flow-templates'

import type { MutationResolvers } from '../__generated__/types.generated'

const createFlowTemplate: MutationResolvers['createFlowTemplate'] = async (
  _parent,
  params,
  context,
) => {
  const { flowName, trigger, actions, demoVideoId } = params.input
  return createFlowFromTemplate(
    flowName,
    trigger,
    actions,
    context.currentUser,
    false,
    demoVideoId,
  )
}

export default createFlowTemplate
