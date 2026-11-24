import { ResourceNotFoundException } from '@aws-sdk/client-cloudwatch-logs'
import { describe, expect, it } from 'vitest'
import winston from 'winston'

import { redactLogFields } from '../log-format'

// winston writes the rendered line under this symbol.
const MESSAGE = Symbol.for('message')

function render(entry: Record<string, unknown>): Record<string, unknown> {
  const info = winston.format
    .combine(redactLogFields(), winston.format.json())
    .transform({ level: 'error', ...entry } as never) as Record<
    string | symbol,
    unknown
  >
  return JSON.parse(info[MESSAGE] as string)
}

// Shaped like an error from the SDK's error deserializer.
function sdkError(): Error {
  return Object.assign(
    new ResourceNotFoundException({
      $metadata: {
        httpStatusCode: 400,
        requestId: 'req-1',
        attempts: 1,
        cfId: 'cf-1',
      },
      message: 'The specified log group does not exist.',
    }),
    {
      $response: {
        statusCode: 400,
        headers: { 'x-amzn-requestid': 'req-1', 'set-cookie': 'sid=abc' },
        body: '{"Message":"officer@agency.gov.sg"}',
      },
      Message: 'officer@agency.gov.sg',
      HostId: 'host-1',
      code: 'ResourceNotFoundException',
    },
  )
}

describe('redactLogFields', () => {
  it('keeps only the safe fields of an AWS SDK error', () => {
    const { err } = render({
      event: 'analytics.mutation_log.error',
      err: sdkError(),
    })

    expect(err).toEqual({
      name: 'ResourceNotFoundException',
      message: 'The specified log group does not exist.',
      stack: expect.stringContaining('ResourceNotFoundException'),
      code: 'ResourceNotFoundException',
      $metadata: { httpStatusCode: 400, requestId: 'req-1' },
    })
    expect(JSON.stringify(err)).not.toContain('officer@agency.gov.sg')
  })

  it('keeps the name and message of a timeout abort', async () => {
    const signal = AbortSignal.timeout(1)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(render({ err: signal.reason }).err).toEqual({
      name: 'TimeoutError',
      message: expect.stringContaining('timeout'),
      stack: expect.any(String),
    })
  })

  it('keeps the safe fields of each cause', () => {
    const err = new Error('mutation_log: 1 day(s) failed: 2026-11-18', {
      cause: sdkError(),
    })

    const rendered = render({ err }).err as Record<string, unknown>

    expect(rendered).toMatchObject({
      message: 'mutation_log: 1 day(s) failed: 2026-11-18',
      cause: {
        name: 'ResourceNotFoundException',
        $metadata: { httpStatusCode: 400, requestId: 'req-1' },
      },
    })
    expect(rendered.cause).not.toHaveProperty('$response')
    expect(rendered.cause).not.toHaveProperty('Message')
  })

  it('drops a code that is not a string', () => {
    const err = Object.assign(new Error('failed'), { code: 42 })

    expect(render({ err }).err).not.toHaveProperty('code')
  })

  it('masks secret keys at any depth', () => {
    expect(
      render({
        event: 'analytics.export.error',
        password: 'hunter2',
        request: {
          headers: { Authorization: 'Bearer abc', accept: 'json' },
          items: [{ accessToken: 'xyz' }],
        },
      }),
    ).toEqual({
      level: 'error',
      event: 'analytics.export.error',
      password: '[REDACTED]',
      request: {
        headers: { Authorization: '[REDACTED]', accept: 'json' },
        items: [{ accessToken: '[REDACTED]' }],
      },
    })
  })

  it('leaves the fields that monitors read unchanged', () => {
    const entry = {
      event: 'analytics.export.coverage',
      job: 'mutation_log',
      missingDays: 2,
      firstMissing: '2026-11-01',
      lastMissing: null,
      staleDays: 0,
      domains: [{ domain: 'agency.gov.sg', verifiedUsers: 3 }],
    }

    expect(render(entry)).toEqual({ level: 'error', ...entry })
  })

  it('names class instances instead of walking into them', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(
      render({ agent: new Map([['a', 1]]), circular, at: new Date(0) }),
    ).toMatchObject({
      agent: '[Map]',
      circular: { self: '[circular]' },
      at: '1970-01-01T00:00:00.000Z',
    })
  })
})
