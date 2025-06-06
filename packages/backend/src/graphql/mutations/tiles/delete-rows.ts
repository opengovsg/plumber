import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteRows: MutationResolvers['deleteRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, rowIds } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query().findById(tableId).throwIfNotFound()
  const tableOperations = getTableOperations(table.db)

  await tableOperations.deleteTableRows({ tableId, rowIds })

  return rowIds
}

export default deleteRows
