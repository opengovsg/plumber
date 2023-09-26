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
    .withGraphFetched('columns')
    .findById(tableId)
    .throwIfNotFound()

  const columnIdsSet = new Set(table.columns.map((column) => column.id))

  // Ensure that all keys in data are valid column ids
  for (const key of Object.keys(data)) {
    if (!columnIdsSet.has(key)) {
      throw new Error(`Invalid column id: ${key}`)
    }
  }

  const row = await createTableRow({ tableId, data })

  return row
}

export default createRow
