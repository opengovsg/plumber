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

  await table.$relatedQuery('columns').insert({
    name: 'Column 1',
  })

  return table
}

export default createTable
