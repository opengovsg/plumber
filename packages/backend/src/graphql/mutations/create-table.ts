import TableColumnMetadata from '@/models/table-column-metadata'
import Context from '@/types/express/context'

type Params = {
  input: {
    name: string
  }
}

const createTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const tableName = params.input.name

  const table = await context.currentUser.$relatedQuery('tables').insert({
    name: tableName,
  })

  await TableColumnMetadata.query().insert({
    name: 'Column 1',
    tableId: table.id,
  })

  return table
}

export default createTable
