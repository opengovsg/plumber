import { BadUserInputError } from '@/errors/graphql-errors'
import { createFlowFromTemplate } from '@/helpers/flow-templates'

import type { MutationResolvers } from '../__generated__/types.generated'

const createTemplatedFlow: MutationResolvers['createTemplatedFlow'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  return createFlowFromTemplate(input.templateId, context.currentUser)
}

export default createTemplatedFlow
