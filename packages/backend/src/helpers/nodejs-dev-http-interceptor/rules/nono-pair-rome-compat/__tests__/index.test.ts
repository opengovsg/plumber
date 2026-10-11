import http from 'http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getEnvProxyAgent } from '../../../env-proxy-agent'
import type { DevRequest } from '../../../types'
import { DEV_REQUEST_RULES } from '../../index'
import { PAIR_ROME_PROJECT_HEADER } from '../prod-constants'
import { nonoPairRomeCompatRule } from '..'

const mockAppConfig = vi.hoisted(() => ({
  pair: { rome: { baseUrl: '' } },
}))

vi.mock('@/config/app', () => ({ default: mockAppConfig }))

describe('nonoPairRomeCompatRule', () => {
  const url = new URL('https://rome.pair.gov.sg/api/public/otel/v1/traces?a=1')

  function projectHeaders(): Headers {
    return new Headers({
      [PAIR_ROME_PROJECT_HEADER]: 'aiBuilder',
      'x-other': '1',
    })
  }

  function rewrite(): DevRequest {
    const request: DevRequest = {
      url: new URL(url),
      headers: projectHeaders(),
      agent: new http.Agent(),
    }
    nonoPairRomeCompatRule.rewrite(request)
    return request
  }

  beforeEach(() => {
    vi.stubEnv('NONO_PROXY_TOKEN', 'test-token')
    mockAppConfig.pair.rome.baseUrl = 'https://rome.pair.gov.sg/'
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('applies to Rome requests with the project header inside nono', () => {
    expect(
      nonoPairRomeCompatRule.isApplicableRequest({
        url,
        headers: projectHeaders(),
      }),
    ).toBe(true)
  })

  it('does not apply to requests without the project header', () => {
    expect(
      nonoPairRomeCompatRule.isApplicableRequest({
        url,
        headers: new Headers(),
      }),
    ).toBe(false)
  })

  it.each([
    ['another host', 'https://rome.example/api/public/otel/v1/traces'],
    ['a subdomain', 'https://other.rome.pair.gov.sg/api/public/otel/v1/traces'],
  ])('does not apply to requests to %s', (_label, otherUrl) => {
    expect(
      nonoPairRomeCompatRule.isApplicableRequest({
        url: new URL(otherUrl),
        headers: projectHeaders(),
      }),
    ).toBe(false)
  })

  it.each([
    ['unset', ''],
    ['unparseable', 'not a url'],
  ])('does not apply when the Rome base URL is %s', (_label, baseUrl) => {
    mockAppConfig.pair.rome.baseUrl = baseUrl

    expect(
      nonoPairRomeCompatRule.isApplicableRequest({
        url,
        headers: projectHeaders(),
      }),
    ).toBe(false)
  })

  it.each([
    ['unset', undefined],
    ['empty', ''],
  ])('does not apply when NONO_PROXY_TOKEN is %s', (_label, token) => {
    vi.stubEnv('NONO_PROXY_TOKEN', token)

    expect(
      nonoPairRomeCompatRule.isApplicableRequest({
        url,
        headers: projectHeaders(),
      }),
    ).toBe(false)
  })

  it('moves the project header into the project_name query param', () => {
    const request = rewrite()

    expect(request.url.toString()).toBe(
      'https://rome.pair.gov.sg/api/public/otel/v1/traces?a=1&project_name=aiBuilder',
    )
    expect(request.headers.has(PAIR_ROME_PROJECT_HEADER)).toBe(false)
    expect(request.headers.get('x-other')).toBe('1')
  })

  it("replaces the caller's agent with the env proxy agent", () => {
    expect(rewrite().agent).toBe(getEnvProxyAgent('https:'))
  })

  it('is registered in DEV_REQUEST_RULES', () => {
    expect(DEV_REQUEST_RULES).toContain(nonoPairRomeCompatRule)
  })
})
