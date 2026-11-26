import jwt from 'jsonwebtoken'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/app', () => ({
  default: {
    sessionSecretKey: 'test-secret-key',
  },
}))

import {
  generateViewToken,
  hashTilePassword,
  verifyTilePassword,
  verifyViewToken,
} from '../auth-tiles'

describe('auth-tiles', () => {
  describe('verifyTilePassword', () => {
    it('returns true for the correct password', async () => {
      const viewOnlyKey = 'view-only-key'
      const hash = await hashTilePassword('password123', viewOnlyKey)
      expect(await verifyTilePassword('password123', hash, viewOnlyKey)).toBe(
        true,
      )
    })

    it('returns false for an incorrect password', async () => {
      const viewOnlyKey = 'view-only-key'
      const hash = await hashTilePassword('password123', viewOnlyKey)
      expect(
        await verifyTilePassword(
          'wrong-password912783901823129837',
          hash,
          viewOnlyKey,
        ),
      ).toBe(false)
    })

    it('accepts a hash stored before hashing became async', async () => {
      // scryptSync('password123', 'view-only-key', 64) in base64.
      const legacyHash =
        'G40r4sQft66eesPFqQq9Dj8/8lANMZa1737QYouwNfk4Gd5+lGntsnEbRq85zpYPL/tnC3LDRYwiXZ6La1MLsA=='
      expect(
        await verifyTilePassword('password123', legacyHash, 'view-only-key'),
      ).toBe(true)
    })

    it('returns false when viewOnlyKey does not match', async () => {
      const hash = await hashTilePassword('password123', 'key-1')
      expect(await verifyTilePassword('password123', hash, 'key-2')).toBe(false)
    })
  })

  describe('verifyViewToken', () => {
    const tileId = 'tile-1'
    const viewOnlyKey = 'vok-1'
    const tokenNonce = 'nonce-1'

    it('returns true for a valid token with matching params', () => {
      const token = generateViewToken(tileId, viewOnlyKey, tokenNonce)
      expect(verifyViewToken(token, tileId, viewOnlyKey, tokenNonce)).toBe(true)
    })

    it('returns false when tileId does not match', () => {
      const token = generateViewToken(tileId, viewOnlyKey, tokenNonce)
      expect(
        verifyViewToken(token, 'wrong-tile', viewOnlyKey, tokenNonce),
      ).toBe(false)
    })

    it('returns false when viewOnlyKey does not match', () => {
      const token = generateViewToken(tileId, viewOnlyKey, tokenNonce)
      expect(verifyViewToken(token, tileId, 'wrong-key', tokenNonce)).toBe(
        false,
      )
    })

    it('returns false when tokenNonce does not match', () => {
      const token = generateViewToken(tileId, viewOnlyKey, tokenNonce)
      expect(verifyViewToken(token, tileId, viewOnlyKey, 'wrong-nonce')).toBe(
        false,
      )
    })

    it('returns false for a malformed token', () => {
      expect(
        verifyViewToken('not-a-jwt', tileId, viewOnlyKey, tokenNonce),
      ).toBe(false)
    })

    it('returns false for a token signed with a different secret', () => {
      const badToken = jwt.sign(
        { tileId, viewOnlyKey, tokenNonce },
        'different-secret',
      )
      expect(verifyViewToken(badToken, tileId, viewOnlyKey, tokenNonce)).toBe(
        false,
      )
    })

    it('returns false for an expired token', () => {
      const expiredToken = jwt.sign(
        { tileId, viewOnlyKey, tokenNonce },
        'test-secret-key',
        {
          expiresIn: '-1s',
        },
      ) as unknown as string // sorry for force casting, im not sure why it's not typed properly
      expect(
        verifyViewToken(expiredToken, tileId, viewOnlyKey, tokenNonce),
      ).toBe(false)
    })

    it('re-throws non-JWT errors', () => {
      vi.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('unexpected error')
      })
      expect(() =>
        verifyViewToken('token', tileId, viewOnlyKey, tokenNonce),
      ).toThrow('unexpected error')
      vi.restoreAllMocks()
    })
  })
})
