import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'

import type { MutationResolvers } from '../__generated__/types.generated'

const moveFlowToFolder: MutationResolvers['moveFlowToFolder'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, folderId } = params.input

  // Filing is a personal organisational act, not an edit to the pipe, so
  // viewer access is the correct floor - this also scopes the flow lookup
  // to flows this user can actually see.
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'viewer' })
    .findOne({ 'flows.id': flowId })
    .throwIfNotFound()

  if (folderId != null) {
    // Scoped by user_id: filing into someone else's folder is impossible -
    // it looks not-found, never a silent success.
    await FlowFolder.query()
      .findOne({ id: folderId, user_id: context.currentUser.id })
      .throwIfNotFound()
  }

  await FlowFolderItem.moveFlowToFolder({
    userId: context.currentUser.id,
    flowId,
    folderId: folderId ?? null,
  })

  return flow
}

export default moveFlowToFolder
