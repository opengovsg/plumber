import { randomUUID } from 'crypto'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createShareableTableLink: NonNullable<
  MutationResolvers['createShareableTableLink']
> = async (_parent, params, context) => {
  const tableId = params.tableId

  // TODO: when implementing collaborators, only allow owner or editor
  const table = await await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  const newViewOnlyKey = randomUUID()

  await table.$query().patch({
    viewOnlyKey: newViewOnlyKey,
  })

  return newViewOnlyKey
}

export default createShareableTableLink
