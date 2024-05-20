import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteTable: MutationResolvers['deleteTable'] = async (
  _parent,
  params,
  context,
) => {
  await TableMetadata.transaction(async (trx) => {
    await TableCollaborator.hasAccess(
      context.currentUser.id,
      params.input.id,
      'owner',
    )

    const table = await TableMetadata.query()
      .findById(params.input.id)
      .throwIfNotFound()

    await table.$relatedQuery('columns', trx).delete()
    await table.$query(trx).delete()
  })

  return true
}

export default deleteTable
