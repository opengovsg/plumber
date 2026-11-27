import type { IJSONObject } from '@plumber/types'
import type { Transaction } from 'objection'
import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
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
  const tableId = z.string().uuid().safeParse(parameters.tableId)
  if (!tableId.success) {
    throw new BadUserInputError('Invalid Tile')
  }
  await TableCollaborator.hasAccess(
    userId,
    tableId.data,
    'editor',
    undefined,
    trx,
  )
}
