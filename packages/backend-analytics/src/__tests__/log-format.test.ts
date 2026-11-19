import { describe, expect, it } from 'vitest'
import winston from 'winston'

import { nestedErrors } from '../log-format'

// winston writes the rendered line under this symbol.
const MESSAGE = Symbol.for('message')

function render(entry: winston.Logform.TransformableInfo): unknown {
  const info = winston.format
    .combine(nestedErrors(), winston.format.json())
    .transform(entry) as winston.Logform.TransformableInfo
  return JSON.parse(info[MESSAGE] as string)
}

describe('nestedErrors', () => {
  it('writes the message, stack and extra fields of a nested error', () => {
    const err = Object.assign(new Error('Could not load credentials'), {
      name: 'CredentialsProviderError',
      tryNextLink: false,
    })

    expect(
      render({
        level: 'error',
        message: { event: 'analytics.export.error', err },
      }),
    ).toEqual({
      level: 'error',
      message: {
        event: 'analytics.export.error',
        err: {
          name: 'CredentialsProviderError',
          message: 'Could not load credentials',
          stack: expect.stringContaining('Could not load credentials'),
          tryNextLink: false,
        },
      },
    })
  })

  it('writes the cause of an error', () => {
    const err = new Error('mutation_log: 1 day(s) failed: 2026-11-18', {
      cause: new Error('connect ECONNREFUSED'),
    })

    expect(render({ level: 'error', message: { err } })).toMatchObject({
      message: {
        err: {
          message: 'mutation_log: 1 day(s) failed: 2026-11-18',
          cause: { name: 'Error', message: 'connect ECONNREFUSED' },
        },
      },
    })
  })
})
