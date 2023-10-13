import { IJSONPrimitive } from '@plumber/types'

import { createTableRow } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: {
    tableId: string
    data: Record<string, IJSONPrimitive>
  }
}

const createRow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { tableId, data } = params.input
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRowKeys(data))) {
    throw new Error('Invalid column id')
  }

  const row = await createTableRow({ tableId, data })

  return row
}

export default createRow
