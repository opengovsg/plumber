import { createTableRows } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createRows: MutationResolvers['createRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, dataArray } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query()
    .withGraphFetched('columns')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRows(dataArray))) {
    throw new Error('Invalid column id')
  }

  const gsis = TableColumnMetadata.getGsisFromColumns(table.columns)

  await createTableRows({ tableId, dataArray, gsis })

  return true
}

export default createRows
