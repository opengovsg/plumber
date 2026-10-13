import http from 'http'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { install } from '..'

import {
  createMarkerRule,
  createRecordingServer,
  sendWithHttp,
} from './test-utils'

describe('engine', () => {
  const recorder = createRecordingServer()
  let baseUrl: string

  beforeAll(async () => {
    install([
      {
        isApplicableRequest: ({ headers }) => headers.has('x-test-suppress'),
        rewrite: (request) => {
          request.headers.delete('x-test-suppress')
          request.headers.delete('x-test-b')
        },
      },
      createMarkerRule('x-test-a', (request) => {
        request.headers.set('x-added', 'yes')
      }),
      createMarkerRule('x-test-b'),
      {
        isApplicableRequest: ({ headers }) => headers.has('x-test-keep'),
        rewrite: (request) => {
          request.url.searchParams.set('kept', 'yes')
        },
      },
      {
        isApplicableRequest: ({ url }) => url.searchParams.has('dev-query'),
        rewrite: (request) => {
          request.url.searchParams.delete('dev-query')
          request.headers.set('x-query-rule', 'yes')
        },
      },
    ])
    baseUrl = await recorder.listen()
  })

  afterAll(async () => {
    await recorder.close()
  })

  beforeEach(() => {
    recorder.received.length = 0
  })

  it('rewrites http.request(url, options) without mutating caller headers', async () => {
    const headers = { 'x-test-a': 'one', 'x-other': '1' }
    await sendWithHttp([new URL(`${baseUrl}/path?a=1`), { headers }])

    expect(recorder.received[0].url).toBe('/path?a=1&marker=one')
    expect(recorder.received[0].headers['x-test-a']).toBeUndefined()
    expect(recorder.received[0].headers['x-added']).toBe('yes')
    expect(recorder.received[0].headers['x-other']).toBe('1')
    expect(headers['x-test-a']).toBe('one')
  })

  it('rewrites http.request(options) and matches header names in any case', async () => {
    const { hostname, port } = new URL(baseUrl)
    await sendWithHttp([
      { hostname, port, path: '/path', headers: { 'X-Test-B': 'two' } },
    ])

    expect(recorder.received[0].url).toBe('/path?marker=two')
    expect(recorder.received[0].headers['x-test-b']).toBeUndefined()
  })

  it('rewrites http.request(url, callback) with no options', async () => {
    await new Promise<void>((resolve, reject) => {
      http
        .request(`${baseUrl}/path?dev-query=1`, (res) => {
          res.resume()
          res.on('end', resolve)
        })
        .on('error', reject)
        .end()
    })

    expect(recorder.received[0].url).toBe('/path')
    expect(recorder.received[0].headers['x-query-rule']).toBe('yes')
  })

  it('rewrites fetch(url, init)', async () => {
    await fetch(`${baseUrl}/path`, {
      headers: { 'x-test-a': 'three', 'x-other': '1' },
    })

    expect(recorder.received[0].url).toBe('/path?marker=three')
    expect(recorder.received[0].headers['x-test-a']).toBeUndefined()
    expect(recorder.received[0].headers['x-other']).toBe('1')
  })

  it('rewrites fetch(request)', async () => {
    await fetch(
      new Request(`${baseUrl}/path`, { headers: { 'x-test-b': 'four' } }),
    )

    expect(recorder.received[0].url).toBe('/path?marker=four')
  })

  it('leaves requests that no rule applies to unchanged', async () => {
    await fetch(`${baseUrl}/plain`)
    await sendWithHttp([`${baseUrl}/plain`, {}])

    expect(recorder.received.map((r) => r.url)).toEqual(['/plain', '/plain'])
  })

  it('sends the marker header when the rule keeps it', async () => {
    await fetch(`${baseUrl}/path`, { headers: { 'x-test-keep': '1' } })

    expect(recorder.received[0].url).toBe('/path?kept=yes')
    expect(recorder.received[0].headers['x-test-keep']).toBe('1')
  })

  it('applies every matching rule in declared order', async () => {
    await sendWithHttp([
      `${baseUrl}/path`,
      { headers: { 'x-test-b': 'second', 'x-test-a': 'first' } },
    ])

    expect(recorder.received[0].url).toBe('/path?marker=first&marker=second')
  })

  it('skips a later rule when an earlier rule removes what it matches on', async () => {
    await fetch(`${baseUrl}/path`, {
      headers: { 'x-test-suppress': '1', 'x-test-b': 'skipped' },
    })

    expect(recorder.received[0].url).toBe('/path')
    expect(recorder.received[0].headers['x-test-b']).toBeUndefined()
  })

  it('refuses to install twice', () => {
    expect(() => install([])).toThrow(
      'Node.js dev HTTP interceptor is already installed',
    )
  })

  describe('when the engine cannot parse a request', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Silences expected engine output.
    })

    afterEach(() => {
      consoleError.mockClear()
    })

    afterAll(() => {
      consoleError.mockRestore()
    })

    it('sends the http request unchanged and logs the error once', async () => {
      const { hostname, port } = new URL(baseUrl)
      const send = () =>
        sendWithHttp([
          { hostname, port, path: 'http://[', headers: { 'x-test-a': '1' } },
        ])
      await send()
      await send()

      expect(recorder.received.map((r) => r.url)).toEqual([
        'http://[',
        'http://[',
      ])
      expect(recorder.received[0].headers['x-test-a']).toBe('1')
      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(consoleError.mock.calls[0][0]).toContain(
        'Skipped rules for a http request the engine could not parse: Invalid URL',
      )
    })

    it('passes the fetch call through and logs the error', async () => {
      await expect(fetch('not a url')).rejects.toThrow()

      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(consoleError.mock.calls[0][0]).toContain('fetch request')
    })
  })
})
