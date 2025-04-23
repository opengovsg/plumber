import { updateTableRow } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const updateRow: MutationResolvers['updateRow'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, rowId, data } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query()
    .withGraphFetched('columns')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRows([data]))) {
    throw new Error('Invalid column id')
  }

  const gsis = TableColumnMetadata.getGsisFromColumns(table.columns)

  await updateTableRow({ tableId, rowId, data, gsis })

  return rowId
}

export default updateRow
