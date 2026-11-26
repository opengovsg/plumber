import { timingSafeEqual } from 'crypto'

import { tileViewPasswordMaxLength } from '@plumber/shared'

import { ForbiddenError } from '@/errors/graphql-errors'
import { generateViewToken, verifyTilePassword } from '@/helpers/auth-tiles'
import { getClientIp } from '@/helpers/get-client-ip'
import {
  clearTilePasswordAttempts,
  consumeTilePasswordAttempt,
} from '@/helpers/tiles-password-lockout'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const verifyTableViewPassword: NonNullable<
  MutationResolvers['verifyTableViewPassword']
> = async (_parent, params, context) => {
  const { tableId, password } = params.input

  const table = await TableMetadata.query().findById(tableId).throwIfNotFound()

  /**
   * We check that shareable link is enabled first
   */
  if (!table.viewOnlyKey || !table.viewOnlyPassword) {
    throw new ForbiddenError("Shareable link or password isn't enabled.")
  }

  const clientIp = getClientIp(context.req)

  const viewOnlyKeyBuffer = Buffer.from(table.viewOnlyKey)
  const tilesViewKeyBuffer = Buffer.from(context.tilesViewKey ?? '')
  // Hashed before the attempt is charged, so a full hash queue spends none.
  // An overlong password or a bad view key still counts as an attempt below.
  const isCorrect =
    password.length <= tileViewPasswordMaxLength &&
    // timingSafeEqual throws on unequal lengths, which would skip the charge.
    tilesViewKeyBuffer.length === viewOnlyKeyBuffer.length &&
    timingSafeEqual(viewOnlyKeyBuffer, tilesViewKeyBuffer) &&
    (await verifyTilePassword(
      password,
      table.viewOnlyPassword.hash,
      table.viewOnlyKey,
    ))
  // Charged before the result is used, so concurrent guesses cannot skip it.
  // A locked-out client is refused here.
  await consumeTilePasswordAttempt(tableId, clientIp)
  if (!isCorrect) {
    throw new ForbiddenError('Invalid password')
  }

  await clearTilePasswordAttempts(tableId, clientIp)

  const token = generateViewToken(
    table.id,
    table.viewOnlyKey,
    table.viewOnlyPassword.tokenNonce,
  )
  return token
}

export default verifyTableViewPassword
