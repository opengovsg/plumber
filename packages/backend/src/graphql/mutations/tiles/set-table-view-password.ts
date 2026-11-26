import { randomUUID } from 'crypto'

import {
  tileViewPasswordMaxLength,
  tileViewPasswordMinLength,
} from '@plumber/shared'
import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import { hashTilePassword } from '@/helpers/auth-tiles'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const setTableViewPasswordSchema = z.object({
  tableId: z.string(),
  password: z
    .string()
    .min(tileViewPasswordMinLength)
    .max(tileViewPasswordMaxLength),
})

const setTableViewPassword: NonNullable<
  MutationResolvers['setTableViewPassword']
> = async (_parent, params, context) => {
  const result = setTableViewPasswordSchema.safeParse(params.input)
  if (!result.success) {
    throw new BadUserInputError(
      `Ensure password is ${tileViewPasswordMinLength}-${tileViewPasswordMaxLength} characters long`,
    )
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

  const { viewOnlyKey } = table
  const hash = await hashTilePassword(password, viewOnlyKey)
  // The link can be replaced while the hash waits, and a hash salted with the
  // old key would never verify against the new one.
  const updatedCount = await table
    .$query()
    .patch({
      viewOnlyPassword: {
        hash,
        tokenNonce: randomUUID(),
      },
    })
    .where({ view_only_key: viewOnlyKey })
  if (updatedCount === 0) {
    throw new BadUserInputError(
      'The shareable link changed. Please set the password again.',
    )
  }

  return true
}

export default setTableViewPassword
