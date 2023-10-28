import Context from '@/types/express/context'

const getTables = async (
  _parent: unknown,
  _params: unknown,
  context: Context,
) => {
  const tables = await context.currentUser
    .$relatedQuery('tables')
    .withGraphJoined('columns')

  return tables
}

export default getTables
