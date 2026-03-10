import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import jwt, { JsonWebTokenError } from 'jsonwebtoken'

import appConfig from '@/config/app'

const { sessionSecretKey } = appConfig

const SCRYPT_KEY_LENGTH = 64

interface TileViewTokenPayload {
  tileId: string
  viewOnlyKey: string
  tokenNonce: string
}

const VIEW_TOKEN_EXPIRES_IN_SEC = 24 * 60 * 60 // 24 hours

// Uses viewOnlyKey as salt - no separate salt column needed
// When viewOnlyKey is changed, the password hash will be invalidated
export function hashTilePassword(
  password: string,
  viewOnlyKey: string,
): string {
  return scryptSync(password, viewOnlyKey, SCRYPT_KEY_LENGTH).toString('base64')
}

export function verifyTilePassword(
  password: string,
  storedHash: string,
  viewOnlyKey: string,
): boolean {
  const inputHashBuffer = scryptSync(password, viewOnlyKey, SCRYPT_KEY_LENGTH)
  const storedHashBuffer = Buffer.from(storedHash, 'base64')
  if (inputHashBuffer.length !== storedHashBuffer.length) {
    return false
  }
  return timingSafeEqual(inputHashBuffer, storedHashBuffer)
}

export function generateTokenNonce(): string {
  return randomBytes(32).toString('base64')
}

/**
 * This will be stored in session storage
 */

export function generateViewToken(
  tileId: string,
  viewOnlyKey: string,
  tokenNonce: string,
): string {
  /**
   * The token is invalidated when viewOnlyKey or tokenNonce (correlated with password) is changed
   */
  return jwt.sign({ tileId, viewOnlyKey, tokenNonce }, sessionSecretKey, {
    expiresIn: VIEW_TOKEN_EXPIRES_IN_SEC,
  })
}

export function verifyViewToken(
  token: string,
  tileId: string,
  viewOnlyKey: string,
  tokenNonce: string,
): boolean {
  try {
    const payload = jwt.verify(token, sessionSecretKey) as TileViewTokenPayload
    return (
      payload.tileId === tileId &&
      payload.viewOnlyKey === viewOnlyKey &&
      payload.tokenNonce === tokenNonce
    )
  } catch (err) {
    if (err instanceof JsonWebTokenError) {
      return false // expired, malformed, or invalid signature
    }
    throw err
  }
}
