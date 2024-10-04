import { createFlowFromTemplate } from '@/helpers/flow-templates'

import type { MutationResolvers } from '../__generated__/types.generated'

const createTemplatedFlow: MutationResolvers['createTemplatedFlow'] = async (
  _parent,
  params,
  context,
) => {
  return createFlowFromTemplate(params.input.templateId, context.currentUser)
}

export default createTemplatedFlow
