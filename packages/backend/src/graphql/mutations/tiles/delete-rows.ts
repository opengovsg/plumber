import TableCollaborator from '@/models/table-collaborators'
import { deleteTableRows } from '@/models/tiles/dynamodb/table-row'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteRows: MutationResolvers['deleteRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, rowIds } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  await deleteTableRows({ tableId, rowIds })

  return rowIds
}

export default deleteRows
