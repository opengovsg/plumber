import { timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

export const ssoCallbackQuerySchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
  state: z.string().optional(),
  iss: z.string().optional(),
  code: z.string().optional(),
})

export type SsoCallbackDecision =
  | { type: 'idp-error' }
  | { type: 'invalid' }
  | { type: 'ok'; code: string }

function statesMatch(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) {
    return false
  }
  return timingSafeEqual(leftBuf, rightBuf)
}

/**
 * Callback checks are order-sensitive. A forged callback must die before the
 * token exchange so it cannot burn the IdP's per-IP token quota.
 */
export function decideSsoCallback({
  query,
  storedState,
  issuer,
}: {
  query: z.infer<typeof ssoCallbackQuerySchema>
  storedState: string
  issuer: string
}): SsoCallbackDecision {
  if (query.error) {
    return { type: 'idp-error' }
  }

  if (!query.state || !statesMatch(query.state, storedState)) {
    return { type: 'invalid' }
  }

  if (query.iss !== issuer) {
    return { type: 'invalid' }
  }

  if (!query.code) {
    return { type: 'invalid' }
  }

  return { type: 'ok', code: query.code }
}
