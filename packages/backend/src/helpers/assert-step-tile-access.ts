import type { IJSONObject } from '@plumber/types'
import type { Transaction } from 'objection'

import TableCollaborator from '@/models/table-collaborators'

export async function assertStepTileAccess({
  userId,
  appKey,
  parameters,
  trx,
}: {
  userId: string
  appKey: string | null | undefined
  parameters: IJSONObject | null | undefined
  trx: Transaction
}): Promise<void> {
  if (appKey !== 'tiles' || !parameters?.tableId) {
    return
  }
  await TableCollaborator.hasAccess(
    userId,
    parameters.tableId as string,
    'editor',
    undefined,
    trx,
  )
}
