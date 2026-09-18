import { timingSafeEqual } from 'crypto'

import { ForbiddenError } from '@/errors/graphql-errors'
import { generateViewToken, verifyTilePassword } from '@/helpers/auth-tiles'
import { getClientIp } from '@/helpers/get-client-ip'
import {
  clearTilePasswordAttempts,
  consumeTilePasswordAttempt,
} from '@/helpers/tiles-password-lockout'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const verifyTableViewPassword: MutationResolvers['verifyTableViewPassword'] =
  async (_parent, params, context) => {
    const { tableId, password } = params.input

    const table = await TableMetadata.query()
      .findById(tableId)
      .throwIfNotFound()

    /**
     * We check that shareable link is enabled first
     */
    if (!table.viewOnlyKey || !table.viewOnlyPassword) {
      throw new ForbiddenError("Shareable link or password isn't enabled.")
    }

    const clientIp = getClientIp(context.req)
    await consumeTilePasswordAttempt(tableId, clientIp)

    if (
      // If shareable link view key is not provided
      !context.tilesViewKey ||
      // If shareable link view key does not match
      !timingSafeEqual(
        Buffer.from(table.viewOnlyKey),
        Buffer.from(context.tilesViewKey),
      ) ||
      // If password is incorrect
      !verifyTilePassword(
        password,
        table.viewOnlyPassword.hash,
        context.tilesViewKey,
      )
    ) {
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
