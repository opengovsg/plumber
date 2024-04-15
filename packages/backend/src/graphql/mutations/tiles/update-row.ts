import { updateTableRow } from '@/models/dynamodb/table-row'

import type { MutationResolvers } from '../../__generated__/types.generated'

const updateRow: MutationResolvers['updateRow'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, rowId, data } = params.input

  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRows([data]))) {
    throw new Error('Invalid column id')
  }

  await updateTableRow({ tableId, rowId, data })

  return rowId
}

export default updateRow
