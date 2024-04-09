import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteTable: MutationResolvers['deleteTable'] = async (
  _parent,
  params,
  context,
) => {
  await TableMetadata.transaction(async (trx) => {
    const table = await context.currentUser
      .$relatedQuery('tables', trx)
      .findOne({
        id: params.input.id,
      })
      .throwIfNotFound()

    await table.$relatedQuery('columns', trx).delete()
    await table.$query(trx).delete()
  })

  return true
}

export default deleteTable
