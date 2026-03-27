import type { Request } from 'express'

/**
 * Get client IP address from request.
 * Checks in this order:
 * 1. Cloudflare header (cf-connecting-ip)
 * 2. Socket remote address
 *
 * This is the same logic used in GraphQL authentication.
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'] as string
  if (cfIp) {
    return cfIp
  }

  const remoteAddress = req.socket.remoteAddress
  if (remoteAddress) {
    return remoteAddress.split(',')[0].trim()
  }

  return 'unknown'
}
