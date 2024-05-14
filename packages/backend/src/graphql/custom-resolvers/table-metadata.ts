import sortBy from 'lodash/sortBy'

import type { Resolvers } from '../__generated__/types.generated'

type TableMetadataResolver = Resolvers['TableMetadata']

const columns: TableMetadataResolver['columns'] = async (parent) => {
  const columns = await parent
    .$relatedQuery('columns')
    .orderBy('position', 'asc')

  return columns
}

const collaborators: TableMetadataResolver['collaborators'] = async (
  parent,
) => {
  const collaborators = await parent
    .$relatedQuery('collaborators')
    .select('email', 'role')
    .orderBy('role', 'desc')
  return sortBy(
    collaborators,
    [
      (collab) => {
        return ['owner', 'editor', 'viewer'].indexOf(collab.role)
      },
    ],
    (collab) => collab.email,
  ) as { email: string; role: string }[]
}

export default {
  columns,
  collaborators,
} satisfies TableMetadataResolver
