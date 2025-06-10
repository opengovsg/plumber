import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'

import type { MutationResolvers } from '../../__generated__/types.generated'

const updateRow: MutationResolvers['updateRow'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, rowId, data } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query()
    .findById(tableId)
    .throwIfNotFound()
    .withGraphFetched('columns')

  if (!(await table.validateRows([data]))) {
    throw new Error('Invalid column id')
  }

  const tableOperations = getTableOperations(table.db)

  // Set unspecified columns to null
  const columnIds = table.columns.map((column) => column.id)
  for (const column of columnIds) {
    if (!(column in data)) {
      data[column] = null
    }
  }

  await tableOperations.updateTableRow({ tableId, rowId, data })

  return rowId
}

export default updateRow
