import Context from '@/types/express/context'

const getTables = async (
  _parent: unknown,
  _params: unknown,
  context: Context,
) => {
  const tables = await context.currentUser
    .$relatedQuery('tables')
    .withGraphFetched('columns')
    .orderBy('created_at', 'desc')

  return tables
}

export default getTables
