import {
  createDemoFlowFromTemplate,
  createFlowFromTemplate,
} from '@/helpers/flow-templates'

import type { MutationResolvers } from '../__generated__/types.generated'

const createTemplatedFlow: MutationResolvers['createTemplatedFlow'] = async (
  _parent,
  params,
  context,
) => {
  const { templateId, isDemoTemplate } = params.input
  // 2 ways to create templated flow: demo or templates page
  if (isDemoTemplate) {
    return createDemoFlowFromTemplate(templateId, context.currentUser, false)
  }
  return createFlowFromTemplate(templateId, context.currentUser)
}

export default createTemplatedFlow
