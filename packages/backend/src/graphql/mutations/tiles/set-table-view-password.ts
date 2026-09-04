import { randomUUID } from 'crypto'

import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import { hashTilePassword } from '@/helpers/auth-tiles'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const setTableViewPasswordSchema = z.object({
  tableId: z.string(),
  password: z.string().min(8).max(100),
})

const setTableViewPassword: MutationResolvers['setTableViewPassword'] = async (
  _parent,
  params,
  context,
) => {
  const result = setTableViewPasswordSchema.safeParse(params.input)
  if (!result.success) {
    throw new BadUserInputError('Ensure password is 8-100 characters long')
  }
  const { tableId, password } = result.data
  // Must be at least editor
  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query().findById(tableId).throwIfNotFound()

  /**
   * We check that shareable link is enabled first
   */
  if (!table.viewOnlyKey) {
    throw new BadUserInputError('Shareable link must be enabled first')
  }

  await table.$query().patch({
    viewOnlyPassword: {
      hash: hashTilePassword(password, table.viewOnlyKey),
      tokenNonce: randomUUID(),
    },
  })

  return true
}

export default setTableViewPassword
