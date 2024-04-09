import { describe, expect, it } from 'vitest'

import {
  getApiBaseUrl,
  getEnvironmentFromApiKey,
  LetterSgEnvironment,
} from '../../common/api'

describe('API helper functions', () => {
  describe('get environment', () => {
    it('returns staging env if API key is for staging environment', () => {
      expect(getEnvironmentFromApiKey('test_v1_123')).toEqual(
        LetterSgEnvironment.Staging,
      )
    })

    it('returns prod env if API key is for prod environment', () => {
      expect(getEnvironmentFromApiKey('live_v1_321')).toEqual(
        LetterSgEnvironment.Prod,
      )
    })

    it('throws error for invalid API key', () => {
      expect(() => getEnvironmentFromApiKey('random_api_key')).toThrowError(
        'Invalid LetterSG API key format',
      )
    })
  })

  describe('get API base URL', () => {
    it('returns staging URL if API key is for staging environment', () => {
      const url = getApiBaseUrl('test_v1_123')
      expect(url.startsWith('https://staging.letters.gov.sg/api')).toEqual(true)
    })

    it('returns prod URL if API key is for prod environment', () => {
      const url = getApiBaseUrl('live_v1_321')
      expect(url.startsWith('https://letters.gov.sg/api')).toEqual(true)
    })
  })
})
