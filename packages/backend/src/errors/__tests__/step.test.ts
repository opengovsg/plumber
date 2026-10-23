import { Writable } from 'stream'

import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import type { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import * as winston from 'winston'

import { redactSecrets } from '@/helpers/redaction/redact-log-secrets'

import HttpError from '../http'
import PartialStepError from '../partial-error'
import RetriableError from '../retriable-error'
import StepError, {
  attachHiddenCauseIfStepError,
  getStepErrorKind,
} from '../step'
import { UserFacingError } from '../user-facing-error'

const HTTP_ERROR = new HttpError({
  message: 'request failed',
  response: { status: 400, data: { reason: 'bad input' } },
} as unknown as AxiosError)

describe('StepError', () => {
  describe('options constructor', () => {
    it('serializes name, solution, kind and cause details into the message', () => {
      const error = new StepError({
        name: 'Invalid row',
        solution: 'Fix the row',
        kind: 'config',
        cause: HTTP_ERROR,
      })

      expect(JSON.parse(error.message)).toEqual({
        name: 'Invalid row',
        solution: 'Fix the row',
        kind: 'config',
        details: HTTP_ERROR.details,
      })
      expect(error.kind).toBe('config')
      expect(error.cause).toBe(HTTP_ERROR)
      expect(error.name).toBe('StepError')
    })

    it('omits kind from the message when unset', () => {
      const error = new StepError({ name: 'n', solution: 's' })

      expect(JSON.parse(error.message)).toEqual({ name: 'n', solution: 's' })
      expect(error.kind).toBeUndefined()
      expect(error.cause).toBeUndefined()
    })

    it('serializes extra properties', () => {
      const error = new StepError(
        { name: 'n', solution: 's', kind: 'third-party' },
        { partialRetry: { buttonMessage: 'Retry' } },
      )

      expect(JSON.parse(error.message)).toEqual({
        name: 'n',
        solution: 's',
        kind: 'third-party',
        partialRetry: { buttonMessage: 'Retry' },
      })
    })
  })

  describe('deprecated positional constructor', () => {
    it('serializes the same message as before', () => {
      const error = new StepError('n', 's', HTTP_ERROR, { extra: 1 })

      expect(JSON.parse(error.message)).toEqual({
        name: 'n',
        solution: 's',
        details: HTTP_ERROR.details,
        extra: 1,
      })
      expect(error.kind).toBeUndefined()
      expect(error.cause).toBe(HTTP_ERROR)
    })
  })
})

describe('getStepErrorKind', () => {
  it.each(['config', 'third-party', 'internal'] as const)(
    'returns the kind of a StepError with kind %s',
    (kind) => {
      const error = new StepError({ name: 'n', solution: 's', kind })

      expect(getStepErrorKind(error)).toBe(kind)
    },
  )

  it('returns the kind of a PartialStepError', () => {
    const error = new PartialStepError({
      name: 'n',
      solution: 's',
      kind: 'config',
      partialRetry: { buttonMessage: '' },
    })

    expect(getStepErrorKind(error)).toBe('config')
  })

  it('returns internal for a StepError without kind', () => {
    expect(getStepErrorKind(new StepError('n', 's'))).toBe('internal')
  })

  it.each([
    { label: 'plain Error', error: new Error('{"kind":"config"}') },
    { label: 'HttpError', error: HTTP_ERROR },
    {
      label: 'RetriableError',
      error: new RetriableError({
        error: { kind: 'config' },
        delayInMs: 'default',
        delayType: 'step',
      }),
    },
    { label: 'UserFacingError', error: new UserFacingError('bad input') },
    { label: 'object with kind', error: { kind: 'config' } },
    { label: 'null', error: null },
    { label: 'undefined', error: undefined },
  ])('returns internal for a $label', ({ error }) => {
    expect(getStepErrorKind(error)).toBe('internal')
  })
})

describe('attachHiddenCauseIfStepError', () => {
  const makeStepError = () =>
    new StepError({
      name: 'n',
      solution: 's',
      kind: 'third-party',
      cause: HTTP_ERROR,
    })

  it('attaches a StepError as a non-enumerable cause', () => {
    const stepError = makeStepError()
    const target = new UnrecoverableError('step failed')

    attachHiddenCauseIfStepError(target, stepError)

    expect(target.cause).toBe(stepError)
    expect(Object.keys(target)).not.toContain('cause')
    expect(getStepErrorKind(target.cause)).toBe('third-party')
  })

  it('ignores a non-StepError', () => {
    const target = new UnrecoverableError('step failed')

    attachHiddenCauseIfStepError(target, HTTP_ERROR)

    expect(Object.hasOwn(target, 'cause')).toBe(false)
  })

  it('never overwrites an existing cause', () => {
    const existingCause = new Error('existing')
    const target = new Error('step failed', { cause: existingCause })

    attachHiddenCauseIfStepError(target, makeStepError())

    expect(target.cause).toBe(existingCause)
  })

  it('keeps the cause out of a redacted log record', async () => {
    const chunks: string[] = []
    const logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        redactSecrets(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Stream({
          stream: new Writable({
            write(chunk, _encoding, callback) {
              chunks.push(String(chunk))
              callback()
            },
          }),
        }),
      ],
    })
    const target = new UnrecoverableError('step failed')
    attachHiddenCauseIfStepError(target, makeStepError())

    logger.error('job failed', { err: target })
    await new Promise((resolve) => setImmediate(resolve))
    logger.close()

    const record = JSON.parse(chunks.join(''))
    expect(record.err.message).toBe('step failed')
    expect(record.err).not.toHaveProperty('cause')
    expect(chunks.join('')).not.toContain('bad input')
  })
})
