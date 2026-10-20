import { TileMigratingError } from '@/errors/graphql-errors'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import { isTileMigrating } from '@/models/tiles/migration/lease'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteRows: MutationResolvers['deleteRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, rowIds } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query().findById(tableId).throwIfNotFound()

  if (isTileMigrating(table)) {
    throw new TileMigratingError()
  }
  const tableOperations = getTableOperations(table.db)

  await tableOperations.deleteTableRows({ tableId, rowIds })

  return rowIds
}

export default deleteRows
