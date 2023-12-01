import { describe, expect, it } from 'vitest'

import {
  getApiBaseUrl,
  getEnvironmentFromApiKey,
  PaySgEnvironment,
} from '../../common/api'

describe('API functions', () => {
  describe('get environment', () => {
    it('returns staging env if API key is for staging environment', () => {
      expect(getEnvironmentFromApiKey('paysg_stag_1234')).toEqual(
        PaySgEnvironment.Staging,
      )
    })

    it('returns live env if API key is for live environment', () => {
      expect(getEnvironmentFromApiKey('paysg_live_1234')).toEqual(
        PaySgEnvironment.Live,
      )
    })
  })

  describe('get API base URL', () => {
    it('returns staging URL if API key is for staging environment', () => {
      const url = getApiBaseUrl('paysg_stag_1234')
      expect(url.startsWith('https://api-staging.')).toEqual(true)
    })

    it('returns live URL if API key is for live environment', () => {
      const url = getApiBaseUrl('paysg_live_1234')
      expect(url.startsWith('https://api.')).toEqual(true)
    })
  })
})
