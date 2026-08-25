import { countUnfiledFlows } from '@/helpers/flow-folders'

import type { QueryResolvers } from '../__generated__/types.generated'

const getUnfiledFlowCount: QueryResolvers['getUnfiledFlowCount'] = async (
  _parent,
  _params,
  context,
) => {
  return countUnfiledFlows(context.currentUser)
}

export default getUnfiledFlowCount
