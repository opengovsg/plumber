import { describe, expect, it } from 'vitest'

import { getIpFromUrl, isIpAllowed } from '../../common/ip-resolver'

describe('IP resolvers', () => {
  describe('Get IP Async', () => {
    it('should be able to get ip address from urls with path', async () => {
      const ip = await getIpFromUrl('https://mock.codes/200')
      expect(ip).toBeDefined()
    })

    it('should be able to get ip address from urls with subdomains, query params and port', async () => {
      const ip = await getIpFromUrl(
        'https://staging.plumber.gov.sg:443/webhooks/123?test=123',
      )
      expect(ip).toBeDefined()
    })

    it('should be able to get ip address from ip', async () => {
      const ip = await getIpFromUrl('https://127.0.0.1')
      expect(ip).toBe('127.0.0.1')
    })

    it('should be able to get ip address from ip', async () => {
      const ip = await getIpFromUrl('https://1.1.1.1:443/test')
      expect(ip).toBe('1.1.1.1')
    })
  })

  describe('Check if IP is allowed', () => {
    it('should result false for reserved/private IPv4s', () => {
      expect(isIpAllowed('10.16.0.1')).toBe(false)
      expect(isIpAllowed('172.16.0.1')).toBe(false)
      expect(isIpAllowed('172.31.0.1')).toBe(false)
      expect(isIpAllowed('127.0.0.1')).toBe(false)
      expect(isIpAllowed('192.168.0.1')).toBe(false)
    })

    it('should result false for reserved/private IPv6s', () => {
      expect(isIpAllowed('fc00::')).toBe(false)
      expect(isIpAllowed('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(false)
      expect(isIpAllowed('172.31.0.1')).toBe(false)
    })
  })
})
