import type { QueryResolvers } from '../../__generated__/types.generated'

const getTables: NonNullable<QueryResolvers['getTables']> = async (
  _parent,
  _params,
  context,
) => {
  const tables = await context.currentUser
    .$relatedQuery('tables')
    .orderBy('last_accessed_at', 'desc')

  return tables
}

export default getTables
