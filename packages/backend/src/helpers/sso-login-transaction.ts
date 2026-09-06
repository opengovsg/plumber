import { randomBytes } from 'node:crypto'
import { z } from 'zod'

import { redisAppDataClient } from '@/helpers/redis-app-data'

export const SSO_TRANSACTION_COOKIE_NAME = 'plumber.sso.tx'
export const SSO_TRANSACTION_TTL_SECONDS = 10 * 60

const transactionSchema = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  codeVerifier: z.string().min(43),
})

export type SsoLoginTransaction = z.infer<typeof transactionSchema>

function redisKey(transactionId: string): string {
  return `sso-login-tx:${transactionId}`
}

export function createSsoTransactionId(): string {
  return randomBytes(32).toString('base64url')
}

export async function storeSsoLoginTransaction(
  transactionId: string,
  transaction: SsoLoginTransaction,
): Promise<void> {
  await redisAppDataClient.set(
    redisKey(transactionId),
    JSON.stringify(transaction),
    'EX',
    SSO_TRANSACTION_TTL_SECONDS,
  )
}

/**
 * Deletes the record in the same read so a replayed callback finds nothing.
 */
export async function consumeSsoLoginTransaction(
  transactionId: string,
): Promise<SsoLoginTransaction | null> {
  const raw = await redisAppDataClient.getdel(redisKey(transactionId))
  if (!raw) {
    return null
  }

  const parsed = transactionSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    return null
  }

  return parsed.data
}
