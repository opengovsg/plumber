import { countFlowsByFolder } from '@/helpers/flow-folders'

import type { Resolvers } from '../__generated__/types.generated'

type FlowFolderResolver = Resolvers['FlowFolder']

const flowCount: FlowFolderResolver['flowCount'] = async (
  parent,
  _args,
  context,
) => {
  // Callers that already know the count (e.g. getFlowFolders, which
  // computes every folder's count in one grouped query) populate this
  // directly on the model instance so we can skip a query here.
  if (typeof parent.flowCount === 'number') {
    return parent.flowCount
  }

  const flowCountsByFolderId = await countFlowsByFolder(context.currentUser)
  return flowCountsByFolderId[parent.id] ?? 0
}

export default {
  flowCount,
} satisfies FlowFolderResolver
