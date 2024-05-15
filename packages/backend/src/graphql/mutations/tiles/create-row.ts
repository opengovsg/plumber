import { createTableRow } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createRow: MutationResolvers['createRow'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, data } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query().findById(tableId)

  if (!(await table.validateRows([data]))) {
    throw new Error('Invalid column id')
  }

  const row = await createTableRow({ tableId, data })

  return row.rowId
}

export default createRow
