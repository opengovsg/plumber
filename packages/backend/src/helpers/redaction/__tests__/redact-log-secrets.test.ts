import https from 'https'
import { Writable } from 'stream'
import { afterEach, describe, expect, it } from 'vitest'
import * as winston from 'winston'

import { redactSecrets, sanitizeLogValue } from '../redact-log-secrets'

async function captureLog(
  emit: (logger: winston.Logger) => void,
): Promise<string> {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk))
      callback()
    },
  })

  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      redactSecrets(),
      winston.format.json(),
    ),
    transports: [new winston.transports.Stream({ stream })],
  })

  emit(logger)
  await new Promise((resolve) => setImmediate(resolve))
  logger.close()

  return chunks.join('')
}

async function captureRecord(
  emit: (logger: winston.Logger) => void,
): Promise<Record<string, any>> {
  return JSON.parse(await captureLog(emit))
}

const sanitize = (value: unknown): unknown =>
  sanitizeLogValue(value, 0, new WeakSet())

const hasOwn = (obj: object, prop: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, prop)

const shouldOverride = (target: object, p: PropertyKey) =>
  p === 'dd' && !Reflect.has(target, p) && Reflect.isExtensible(target)

/**
 * Mirrors the proxy dd-trace wraps every winston record in when log injection
 * is on, from packages/dd-trace/src/plugins/log_plugin.js.
 */
function injectTraceContext<T extends object>(
  record: T,
  holder: { dd: Record<string, string> },
): T {
  return new Proxy(record, {
    get(target, p, receiver) {
      if (shouldOverride(target, p)) {
        return holder.dd
      }
      return Reflect.get(target, p, receiver)
    },
    ownKeys(target) {
      const ownKeys = Reflect.ownKeys(target)
      return hasOwn(target, 'dd') || !Reflect.isExtensible(target)
        ? ownKeys
        : ['dd', ...ownKeys]
    },
    getOwnPropertyDescriptor(target, p) {
      return Reflect.getOwnPropertyDescriptor(
        shouldOverride(target, p) ? holder : target,
        p,
      )
    },
  })
}

describe('redactSecrets', () => {
  const globalAgent = https.globalAgent as unknown as Record<string, unknown>
  const originalSockets = globalAgent.sockets

  afterEach(() => {
    globalAgent.sockets = originalSockets
  })

  it('does not leak another request Authorization header reachable through an agent', async () => {
    globalAgent.sockets = {
      'unrelated.gov.sg:443': [
        {
          _httpMessage: {
            _header:
              'GET / HTTP/1.1\r\nAuthorization: Bearer leaked-token-abc123\r\n\r\n',
          },
        },
      ],
    }

    const agent = new https.Agent({ keepAlive: true })
    Object.assign(agent, {
      sockets: {
        'api.example.gov.sg:443': [
          {
            _httpMessage: {
              _redirectable: {
                _options: { nativeProtocols: { 'https:': https } },
              },
            },
          },
        ],
      },
    })

    const httpError = {
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        config: { url: 'https://api.example.gov.sg', httpsAgent: agent },
      },
    }

    const output = await captureLog((logger) =>
      logger.error('request failed', { error: httpError }),
    )

    expect(output).not.toContain('leaked-token-abc123')
    expect(JSON.parse(output).error.response.config.httpsAgent).toBe('[Agent]')
  })

  it('renders a raw axios error request as its class name', async () => {
    class ClientRequest {
      public agent = new https.Agent()
    }

    const axiosError = Object.assign(
      new Error('Request failed with status 500'),
      {
        isAxiosError: true,
        code: 'ERR_BAD_RESPONSE',
        request: new ClientRequest(),
      },
    )

    const record = await captureRecord((logger) =>
      logger.error('action failed', { error: axiosError }),
    )

    expect(record.error.request).toBe('[ClientRequest]')
    expect(record.error.message).toBe('Request failed with status 500')
    expect(record.error.code).toBe('ERR_BAD_RESPONSE')
    expect(typeof record.error.stack).toBe('string')
  })

  it('redacts secret-bearing keys in nested plain objects', async () => {
    const record = await captureRecord((logger) =>
      logger.info('incoming webhook', {
        req: {
          method: 'POST',
          headers: {
            authorization: 'Bearer real-secret',
            'x-api-key': 'real-secret',
            cookie: 'session=real-secret',
            'content-type': 'application/json',
          },
        },
        details: {
          access_token: 'real-secret',
          refresh_token: 'real-secret',
          accessToken: 'real-secret',
          clientSecret: 'real-secret',
          expires_in: 3600,
        },
      }),
    )

    expect(record.req.headers).toEqual({
      authorization: '[REDACTED]',
      'x-api-key': '[REDACTED]',
      cookie: '[REDACTED]',
      'content-type': 'application/json',
    })
    expect(record.details).toEqual({
      access_token: '[REDACTED]',
      refresh_token: '[REDACTED]',
      accessToken: '[REDACTED]',
      clientSecret: '[REDACTED]',
      expires_in: 3600,
    })
    expect(record.req.method).toBe('POST')
  })

  it('redacts secret-bearing keys at the top level', async () => {
    const record = await captureRecord((logger) =>
      logger.info('connection created', {
        flowId: 'flow-1',
        apiKey: 'real-secret',
      }),
    )

    expect(record.apiKey).toBe('[REDACTED]')
    expect(record.flowId).toBe('flow-1')
  })

  it('leaves a normal structured log unchanged', async () => {
    const record = await captureRecord((logger) =>
      logger.info('flow executed', {
        flowId: 'flow-1',
        executionId: 'execution-1',
        stepId: 'step-1',
        status: 'success',
        count: 3,
        retried: false,
        error: null,
        at: new Date('2024-01-02T03:04:05.678Z'),
        response: {
          statusText: 'OK',
          url: 'https://api.example.gov.sg/v1/things',
          method: 'POST',
          items: [1, 'two', { event: 'created' }],
        },
        note: 'upstream replied 401 to our Bearer header',
      }),
    )

    // dd-trace injects `dd` whenever a tracer is loaded, which CI does for Test
    // Visibility. The fields this test pins down are the caller's own.
    delete record.dd

    expect(record).toEqual({
      level: 'info',
      message: 'flow executed',
      timestamp: expect.any(String),
      flowId: 'flow-1',
      executionId: 'execution-1',
      stepId: 'step-1',
      status: 'success',
      count: 3,
      retried: false,
      error: null,
      at: '2024-01-02T03:04:05.678Z',
      response: {
        statusText: 'OK',
        url: 'https://api.example.gov.sg/v1/things',
        method: 'POST',
        items: [1, 'two', { event: 'created' }],
      },
      note: 'upstream replied 401 to our Bearer header',
    })
  })

  it('delivers level and message to the transport', async () => {
    const record = await captureRecord((logger) => logger.warn('watch out'))

    expect(record.level).toBe('warn')
    expect(record.message).toBe('watch out')
  })

  it('leaves dd-trace log injection serialisable so Datadog keeps service:plumber', () => {
    const holder = {
      dd: {
        trace_id: '1234567890',
        span_id: '9876543210',
        service: 'plumber',
        env: 'prod',
      },
    }
    const record = injectTraceContext(
      { level: 'info', message: 'flow executed', apiKey: 'real-secret' },
      holder,
    )

    const transformed = redactSecrets().transform(record)

    // winston's json format only serialises enumerable own keys.
    expect(JSON.parse(JSON.stringify(transformed))).toMatchObject({
      dd: holder.dd,
      apiKey: '[REDACTED]',
    })
  })

  it('marks a repeated reference as circular only when it is a cycle', async () => {
    const cyclic: Record<string, unknown> = { name: 'root' }
    cyclic.self = cyclic
    const shared = { id: 'shared' }

    const record = await captureRecord((logger) =>
      logger.info('graph', { cyclic, first: shared, second: shared }),
    )

    expect(record.cyclic).toEqual({ name: 'root', self: '[circular]' })
    expect(record.first).toEqual({ id: 'shared' })
    expect(record.second).toEqual({ id: 'shared' })
  })
})

describe('sanitizeLogValue', () => {
  it('passes primitives through and drops functions', () => {
    expect(sanitize('Bearer eyJhbGciOiJIUzI1NiJ9')).toBe(
      'Bearer eyJhbGciOiJIUzI1NiJ9',
    )
    expect(sanitize(42)).toBe(42)
    expect(sanitize(null)).toBeNull()
    expect(sanitize(undefined)).toBeUndefined()
    expect(sanitize(() => 1)).toBeUndefined()
  })

  it('renders a buffer as its byte length', () => {
    expect(sanitize(Buffer.from('hello'))).toBe('[Buffer 5 bytes]')
  })

  it('stops at the maximum depth', () => {
    let deep: Record<string, unknown> = { end: 'reached' }
    for (let i = 0; i < 12; i++) {
      deep = { nested: deep }
    }

    const flattened = JSON.stringify(sanitize(deep))

    expect(flattened).toContain('[max depth]')
    expect(flattened).not.toContain('reached')
  })

  it('truncates a long array', () => {
    const sanitized = sanitize(
      Array.from({ length: 150 }, (_, index) => index),
    ) as unknown[]

    expect(sanitized).toHaveLength(101)
    expect(sanitized[100]).toBe('[50 more items]')
  })

  it('keeps every key of a wide object', () => {
    const wide = Object.fromEntries(
      Array.from({ length: 20_000 }, (_, index) => [`key${index}`, { a: 1 }]),
    )

    const sanitized = sanitize(wide) as Record<string, unknown>

    expect(Object.keys(sanitized)).toHaveLength(20_000)
    expect(sanitized.key19999).toEqual({ a: 1 })
  })
})
