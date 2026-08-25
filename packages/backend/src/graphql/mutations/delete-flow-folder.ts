import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteFlowFolder: MutationResolvers['deleteFlowFolder'] = async (
  _parent,
  params,
  context,
) => {
  const { id } = params.input

  await FlowFolder.transaction(async (trx) => {
    // Scoped by user_id: a folder that belongs to someone else looks
    // not-found, never a silent no-op success.
    const folder = await FlowFolder.query(trx)
      .findOne({ id, user_id: context.currentUser.id })
      .throwIfNotFound()

    // Unfile every pipe filed into this folder. This only ever touches
    // flow_folder_items (the filing record) - the flows themselves are
    // never deleted.
    await FlowFolderItem.query(trx)
      .delete()
      .where({ folder_id: folder.id, user_id: context.currentUser.id })

    await folder.$query(trx).delete()
  })

  return true
}

export default deleteFlowFolder
