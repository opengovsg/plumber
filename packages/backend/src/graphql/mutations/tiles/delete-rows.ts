import { deleteTableRows } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'

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
