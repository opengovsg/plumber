import { IJSONPrimitive } from '@plumber/types'

import { updateTableRow } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: {
    tableId: string
    rowId: string
    data: Record<string, IJSONPrimitive>
  }
}

const updateRow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { tableId, rowId, data } = params.input

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

  await updateTableRow({ tableId, rowId, data })

  return true
}

export default updateRow
