import { countFlowsByFolder } from '@/helpers/flow-folders'
import FlowFolder from '@/models/flow-folder'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlowFolders: QueryResolvers['getFlowFolders'] = async (
  _parent,
  _params,
  context,
) => {
  const folders = await FlowFolder.query()
    .where('user_id', context.currentUser.id)
    .orderBy('name', 'asc')

  // Single grouped query for all folders' counts - never N+1 per folder.
  const flowCountsByFolderId = await countFlowsByFolder(context.currentUser)

  return folders.map((folder) => {
    folder.flowCount = flowCountsByFolderId[folder.id] ?? 0
    return folder
  })
}

export default getFlowFolders
