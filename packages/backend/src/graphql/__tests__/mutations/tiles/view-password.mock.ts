import { randomUUID } from 'crypto'

import { hashTilePassword } from '@/helpers/auth-tiles'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

export const VIEW_PASSWORD = 'correct-horse-battery'

/**
 * `getClientIp` reads `req.headers`, so the shared table mock's `req: null`
 * cannot drive the per-IP lockout.
 */
export function generateViewOnlyContext({
  viewOnlyKey,
  clientIp,
}: {
  viewOnlyKey: string
  clientIp: string
}): Context {
  return {
    req: { headers: { 'x-forwarded-for': clientIp }, socket: {} },
    res: null,
    currentUser: null,
    isAdminOperation: false,
    tilesViewKey: viewOnlyKey,
  } as unknown as Context
}

export async function enableViewPassword(
  table: TableMetadata,
  password: string = VIEW_PASSWORD,
): Promise<string> {
  const viewOnlyKey = randomUUID()
  await table.$query().patch({
    viewOnlyKey,
    viewOnlyPassword: {
      hash: hashTilePassword(password, viewOnlyKey),
      tokenNonce: randomUUID(),
    },
  })
  return viewOnlyKey
}
