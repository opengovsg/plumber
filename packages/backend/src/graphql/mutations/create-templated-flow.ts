import createFlowFromTemplate from '@/helpers/flow-templates'

import type { MutationResolvers } from '../__generated__/types.generated'

const createTemplatedFlow: MutationResolvers['createTemplatedFlow'] = async (
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

export default createTemplatedFlow
