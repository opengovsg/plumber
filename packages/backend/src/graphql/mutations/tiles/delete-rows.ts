import { deleteTableRows } from '@/models/dynamodb/table-row'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteRows: NonNullable<MutationResolvers['deleteRows']> = async (
  _parent,
  params,
  context,
) => {
  const { tableId, rowIds } = params.input

  await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  await deleteTableRows({ tableId, rowIds })

  return rowIds
}

export default deleteRows
