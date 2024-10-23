import paginate from '@/helpers/pagination'

import type { QueryResolvers } from '../../__generated__/types.generated'

const getTables: QueryResolvers['getTables'] = async (
  _parent,
  { limit, offset, name },
  context,
) => {
  const tables = context.currentUser
    .$relatedQuery('tables')
    .where((builder) => {
      if (name) {
        builder.where('table_metadata.name', 'ilike', `%${name}%`)
      }
    })
    .orderBy('last_accessed_at', 'desc')

  return paginate(tables, limit, offset)
}

export default getTables
