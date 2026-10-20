import sortBy from 'lodash/sortBy'

import { isTileMigrating } from '@/models/tiles/migration/lease'

import type { Resolvers } from '../__generated__/types.generated'

type TableMetadataResolver = Resolvers['TableMetadata']

const databaseType: TableMetadataResolver['databaseType'] = async (parent) => {
  return parent.db
}

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
    .where('table_collaborators.deleted_at', null)
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

const isMigrating: TableMetadataResolver['isMigrating'] = async (parent) =>
  isTileMigrating(parent)

export default {
  columns,
  collaborators,
  databaseType,
  isMigrating,
} satisfies TableMetadataResolver
