import type { Request } from 'express'
import { describe, expect, it } from 'vitest'

import { getClientIp } from '../get-client-ip'

function mockRequest({
  xForwardedFor,
  cfConnectingIp,
  remoteAddress,
}: {
  xForwardedFor?: string
  cfConnectingIp?: string
  remoteAddress?: string
}): Request {
  const headers: Record<string, string> = {}
  if (xForwardedFor !== undefined) {
    headers['x-forwarded-for'] = xForwardedFor
  }
  if (cfConnectingIp !== undefined) {
    headers['cf-connecting-ip'] = cfConnectingIp
  }
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as Request
}

// 173.245.48.0/20 and 2400:cb00::/32 are published Cloudflare edge ranges.
// 203.0.113.x / 198.51.100.x / 2001:db8:: are non-Cloudflare documentation ranges.
describe('getClientIp', () => {
  describe('orange cloud — peer is a Cloudflare edge IP', () => {
    it('returns cf-connecting-ip, which Cloudflare sets authoritatively', () => {
      // Values differ to prove the client is sourced from cf-connecting-ip, not
      // from an X-Forwarded-For entry.
      const req = mockRequest({
        xForwardedFor: '198.51.100.99, 173.245.48.1',
        cfConnectingIp: '203.0.113.42',
      })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })

    it('ignores forged X-Forwarded-For entries to the left of the edge', () => {
      const req = mockRequest({
        xForwardedFor: '6.6.6.6, 7.7.7.7, 173.245.48.1',
        cfConnectingIp: '203.0.113.42',
      })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })

    it('resolves an IPv6 client via cf-connecting-ip', () => {
      const req = mockRequest({
        xForwardedFor: '2001:db8::5, 2400:cb00::1',
        cfConnectingIp: '2001:db8::99',
      })
      expect(getClientIp(req)).toBe('2001:db8::99')
    })

    it('normalizes an IPv4-mapped IPv6 cf-connecting-ip to IPv4', () => {
      const req = mockRequest({
        xForwardedFor: '198.51.100.99, 173.245.48.1',
        cfConnectingIp: '::ffff:203.0.113.42',
      })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })

    it('falls back to the edge IP when cf-connecting-ip is missing (anomalous)', () => {
      const req = mockRequest({ xForwardedFor: '198.51.100.99, 173.245.48.1' })
      expect(getClientIp(req)).toBe('173.245.48.1')
    })
  })

  describe('grey cloud — peer is not a Cloudflare IP', () => {
    it('returns the ALB-appended rightmost entry', () => {
      const req = mockRequest({ xForwardedFor: '203.0.113.42' })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })

    it('ignores a spoofed entry to the left of the real peer', () => {
      const req = mockRequest({ xForwardedFor: '1.2.3.4, 203.0.113.42' })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })

    it('does NOT trust cf-connecting-ip — a direct caller can forge it', () => {
      const req = mockRequest({
        xForwardedFor: '203.0.113.42',
        cfConnectingIp: '9.9.9.9',
      })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })

    it('returns an IPv6 client directly', () => {
      const req = mockRequest({ xForwardedFor: '2001:db8::5' })
      expect(getClientIp(req)).toBe('2001:db8::5')
    })

    it('normalizes an IPv4-mapped IPv6 peer to IPv4', () => {
      const req = mockRequest({ xForwardedFor: '::ffff:203.0.113.42' })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })

    it('trims surrounding whitespace around entries', () => {
      const req = mockRequest({ xForwardedFor: '  1.2.3.4 ,  203.0.113.42  ' })
      expect(getClientIp(req)).toBe('203.0.113.42')
    })
  })

  describe('fallback to the transport peer — no X-Forwarded-For', () => {
    it('falls back to the socket remote address', () => {
      const req = mockRequest({ remoteAddress: '198.51.100.7' })
      expect(getClientIp(req)).toBe('198.51.100.7')
    })

    it('does not trust cf-connecting-ip without an X-Forwarded-For peer', () => {
      const req = mockRequest({
        cfConnectingIp: '9.9.9.9',
        remoteAddress: '198.51.100.7',
      })
      expect(getClientIp(req)).toBe('198.51.100.7')
    })

    it('normalizes an IPv4-mapped IPv6 socket address', () => {
      const req = mockRequest({ remoteAddress: '::ffff:198.51.100.7' })
      expect(getClientIp(req)).toBe('198.51.100.7')
    })

    it('returns an IPv6 socket address', () => {
      const req = mockRequest({ remoteAddress: '2001:db8::1' })
      expect(getClientIp(req)).toBe('2001:db8::1')
    })

    it('returns "unknown" when no IP information is available', () => {
      const req = mockRequest({})
      expect(getClientIp(req)).toBe('unknown')
    })
  })
})
