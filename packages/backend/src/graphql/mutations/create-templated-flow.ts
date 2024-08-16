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
  const {
    flowName,
    trigger,
    actions,
    demoVideoId,
    parametersList,
    templateId,
  } = params.input
  // 2 ways to create templated flow: demo or templates page
  if (templateId) {
    return createFlowFromTemplate(
      { flowName, trigger, actions, parametersList, templateId },
      context.currentUser,
    )
  }
  if (demoVideoId) {
    return createDemoFlowFromTemplate(
      { flowName, trigger, actions, demoVideoId },
      context.currentUser,
      false,
    )
  }
  throw new Error('Invalid arguments given to create a templated flow')
}

export default createTemplatedFlow
