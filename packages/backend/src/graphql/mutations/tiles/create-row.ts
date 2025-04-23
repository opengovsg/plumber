import { createTableRow } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createRow: MutationResolvers['createRow'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, data } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query()
    .withGraphFetched('columns')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRows([data]))) {
    throw new Error('Invalid column id')
  }

  const gsis = TableColumnMetadata.getGsisFromColumns(table.columns)

  const row = await createTableRow({ tableId, data, gsis })

  return row.rowId
}

export default createRow
