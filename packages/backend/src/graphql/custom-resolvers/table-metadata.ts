import type { Resolvers } from '../__generated__/types.generated'

type TableMetadataResolver = Resolvers['TableMetadata']

const columns: TableMetadataResolver['columns'] = async (parent) => {
  const columns = await parent
    .$relatedQuery('columns')
    .orderBy('position', 'asc')

  return columns
}

export default {
  columns,
} satisfies TableMetadataResolver
