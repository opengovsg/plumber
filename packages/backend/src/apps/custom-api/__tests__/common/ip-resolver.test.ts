import { describe, expect, it } from 'vitest'

import { getIpFromHostname, isIpAllowed } from '../../common/ip-resolver'

describe('IP resolvers', () => {
  describe('Get IP Async', () => {
    it('should be able to get ip address from urls with path', async () => {
      const ip = await getIpFromHostname('mock.codes')
      expect(ip).toBeDefined()
    })

    it('should be able to get ip address from urls with subdomains', async () => {
      const ip = await getIpFromHostname('staging.plumber.gov.sg')
      expect(ip).toBeDefined()
    })

    it('should not be able to get ip address from ip', async () => {
      await expect(getIpFromHostname(' 127.0.0.1')).rejects.toThrowError(
        'Unable to resolve IP address for  127.0.0.1',
      )
    })
  })

  describe('Check if IP is allowed', () => {
    it('should result false for reserved/private IPv4s', () => {
      expect(isIpAllowed('10.16.0.1')).toBe(false)
      expect(isIpAllowed('172.16.0.1')).toBe(false)
      expect(isIpAllowed('172.31.0.1')).toBe(false)
      expect(isIpAllowed('127.0.0.1')).toBe(false)
      expect(isIpAllowed('192.168.0.1')).toBe(false)
      expect(isIpAllowed('169.254.170.2')).toBe(false)
    })

    it('should result false for reserved/private IPv6s', () => {
      expect(isIpAllowed('fc00::')).toBe(false)
      expect(isIpAllowed('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(false)
      expect(isIpAllowed('172.31.0.1')).toBe(false)
    })
  })
})
