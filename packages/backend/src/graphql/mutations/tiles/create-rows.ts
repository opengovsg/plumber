import { createTableRows } from '@/models/dynamodb/table-row'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createRows: MutationResolvers['createRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, dataArray } = params.input
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRows(dataArray))) {
    throw new Error('Invalid column id')
  }

  await createTableRows({ tableId, dataArray })

  return true
}

export default createRows
