import { describe, expect, it } from 'vitest'

import getApiBaseUrl from '../../common/get-api-base-url'

describe('Get API base URL', () => {
  it('returns staging URL if API key is for staging environment', () => {
    const url = getApiBaseUrl('paysg_stag_1234')
    expect(url.startsWith('https://api-staging.')).toEqual(true)
  })

  it('returns live URL if API key is for live environment', () => {
    const url = getApiBaseUrl('paysg_live_1234')
    expect(url.startsWith('https://api.')).toEqual(true)
  })
})
