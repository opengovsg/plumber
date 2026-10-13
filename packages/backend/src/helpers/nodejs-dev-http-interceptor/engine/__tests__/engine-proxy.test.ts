import http from 'http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getEnvProxyAgent } from '../../env-proxy-agent'
import { install } from '..'

import {
  createMarkerRule,
  createRecordingServer,
  sendWithHttp,
} from './test-utils'

// Separate file because proxy agents read env vars once, and install() runs once per process.
describe('engine with proxy env vars', () => {
  const originalEnv = { ...process.env }
  const proxy = createRecordingServer()
  const target = createRecordingServer()
  let targetUrl: string

  beforeAll(async () => {
    process.env.HTTP_PROXY = await proxy.listen()
    process.env.NO_PROXY = '127.0.0.1'
    targetUrl = await target.listen()

    install([
      createMarkerRule('x-proxied', (request) => {
        request.agent = getEnvProxyAgent(request.url.protocol)
      }),
      createMarkerRule('x-direct'),
    ])
  })

  afterAll(async () => {
    process.env = originalEnv
    await Promise.all([proxy.close(), target.close()])
  })

  beforeEach(() => {
    proxy.received.length = 0
    target.received.length = 0
  })

  it("sends requests through HTTP_PROXY when a rule replaces the caller's agent", async () => {
    await sendWithHttp([
      'http://langfuse.invalid/path',
      { headers: { 'x-proxied': 'one' }, agent: new http.Agent() },
    ])

    expect(proxy.received.map((r) => r.url)).toEqual([
      'http://langfuse.invalid/path?marker=one',
    ])
  })

  it('skips the proxy for NO_PROXY hosts', async () => {
    await sendWithHttp([
      `${targetUrl}/path`,
      { headers: { 'x-proxied': 'two' } },
    ])

    expect(proxy.received).toEqual([])
    expect(target.received.map((r) => r.url)).toEqual(['/path?marker=two'])
  })

  it("keeps the caller's agent when no rule replaces it", async () => {
    await expect(
      sendWithHttp([
        'http://langfuse.invalid/path',
        { headers: { 'x-direct': 'three' }, agent: new http.Agent() },
      ]),
    ).rejects.toThrow()

    expect(proxy.received).toEqual([])
  })

  it('shares one agent per protocol', () => {
    expect(getEnvProxyAgent('http:')).toBe(getEnvProxyAgent('http:'))
    expect(getEnvProxyAgent('https:')).not.toBe(getEnvProxyAgent('http:'))
  })
})
