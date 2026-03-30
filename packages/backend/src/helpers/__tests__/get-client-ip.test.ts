import type { Request } from 'express'
import { describe, expect, it } from 'vitest'

import { getClientIp } from '../get-client-ip'

describe('getClientIp', () => {
  it('should return Cloudflare IP when cf-connecting-ip header is present', () => {
    const mockReq = {
      headers: {
        'cf-connecting-ip': '203.0.113.42',
      },
      socket: {
        remoteAddress: '192.168.1.1',
      },
    } as unknown as Request

    expect(getClientIp(mockReq)).toBe('203.0.113.42')
  })

  it('should return socket remote address when no CF header', () => {
    const mockReq = {
      headers: {},
      socket: {
        remoteAddress: '192.168.1.1',
      },
    } as unknown as Request

    expect(getClientIp(mockReq)).toBe('192.168.1.1')
  })

  it('should trim and return first IP when multiple IPs in remote address', () => {
    const mockReq = {
      headers: {},
      socket: {
        remoteAddress: '192.168.1.1, 10.0.0.1, 172.16.0.1',
      },
    } as unknown as Request

    expect(getClientIp(mockReq)).toBe('192.168.1.1')
  })

  it('should return "unknown" when no IP information is available', () => {
    const mockReq = {
      headers: {},
      socket: {},
    } as unknown as Request

    expect(getClientIp(mockReq)).toBe('unknown')
  })

  it('should prioritize CF header over socket address', () => {
    const mockReq = {
      headers: {
        'cf-connecting-ip': '203.0.113.1',
      },
      socket: {
        remoteAddress: '192.168.1.100',
      },
    } as unknown as Request

    expect(getClientIp(mockReq)).toBe('203.0.113.1')
  })

  it('should handle IPv6 addresses', () => {
    const mockReq = {
      headers: {},
      socket: {
        remoteAddress: '2001:db8::1',
      },
    } as unknown as Request

    expect(getClientIp(mockReq)).toBe('2001:db8::1')
  })
})
