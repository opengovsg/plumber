import {
  createRawTableRows,
  createTableRows,
} from '@/models/dynamodb/table-row'

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

  if (table.name.startsWith('log')) {
    return true
  }
  if (table.name.startsWith('raw')) {
    console.log('RAW')
    await createRawTableRows({ tableId, dataArray })
    return true
  }

  await createTableRows({ tableId, dataArray })

  return true
}

export default createRows
