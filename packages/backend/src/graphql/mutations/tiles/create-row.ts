import { createTableRow } from '@/models/dynamodb/table-row'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createRow: MutationResolvers['createRow'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, data } = params.input
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRows([data]))) {
    throw new Error('Invalid column id')
  }

  const row = await createTableRow({ tableId, data })

  return row.rowId
}

export default createRow
