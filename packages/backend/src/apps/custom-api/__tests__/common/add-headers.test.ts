import { IGlobalVariable } from '@plumber/types'

import { InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import addHeaders from '../../common/add-headers'

function buildGlobalVariable(configuredUrl: string): IGlobalVariable {
  return {
    auth: {
      set: vi.fn(),
      data: { headers: { Authorization: 'Bearer sk-live-secret' } },
    },
    step: {
      id: 'herp-derp',
      appKey: 'custom-api',
      key: 'httpRequest',
      position: 1,
      parameters: { url: configuredUrl },
      version: 1,
    },
  } as unknown as IGlobalVariable
}

function buildRequestConfig(baseURL: string): InternalAxiosRequestConfig {
  return {
    baseURL,
    headers: { set: vi.fn() },
  } as unknown as InternalAxiosRequestConfig
}

describe('addHeaders', () => {
  it('forwards the connection auth header when the redirect stays on the configured origin', async () => {
    const $ = buildGlobalVariable('https://api.example.com/original-path')
    // Same origin, different path: mirrors the second, redirect-following
    // request that actions/http-request/index.ts issues through $.http.
    const requestConfig = buildRequestConfig('https://api.example.com')

    await addHeaders($, requestConfig)

    expect(requestConfig.headers.set).toHaveBeenCalledWith(
      'Authorization',
      'Bearer sk-live-secret',
    )
  })

  it('strips the connection auth header when the redirect target is a different origin', async () => {
    const $ = buildGlobalVariable('https://api.example.com/original-path')
    // Redirect target lands on an attacker-controlled host.
    const requestConfig = buildRequestConfig('https://evil.attacker.com')

    await addHeaders($, requestConfig)

    expect(requestConfig.headers.set).not.toHaveBeenCalledWith(
      'Authorization',
      'Bearer sk-live-secret',
    )
    expect(requestConfig.headers.set).toHaveBeenCalledWith(
      'Content-Type',
      'application/json',
      false,
    )
  })
})
