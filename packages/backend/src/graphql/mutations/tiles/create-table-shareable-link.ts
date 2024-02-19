import { randomUUID } from 'crypto'

import Context from '@/types/express/context'

type Params = {
  tableId: string
}

const createShareableTableLink = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
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
