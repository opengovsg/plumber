/**
 * Business rules:
 * - "`config` never retries, unless its cause is an `HttpError` that `handleHttpError` retries."
 * - "A `StepError` without `kind` keeps today's retry behavior."
 */
import type { IActionJobData, StepErrorKind } from '@plumber/types'
import { type JobPro, UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { type Span } from 'dd-trace'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError, { getStepErrorKind } from '@/errors/step'

import { makeHttpError } from '../../../test/utils/make-http-error'
import { handleFailedStepAndThrow, isRetriableHttpError } from '../actions'
import { MAXIMUM_JOB_ATTEMPTS } from '../default-job-configuration'

const addSpanTags = vi.fn()

const TWELVE_HOURS_IN_SECONDS = 12 * 60 * 60

function makeConfigStepError(cause: HttpError): StepError {
  return new StepError({ name: 'n', solution: 's', kind: 'config', cause })
}

function runWith(executionError: unknown, attemptsMade = 0): unknown {
  try {
    handleFailedStepAndThrow({
      errorDetails: {},
      executionError,
      context: {
        isQueueDelayable: false,
        span: { addTags: addSpanTags } as unknown as Span,
        worker: {} as never,
        job: { attemptsMade } as unknown as JobPro<IActionJobData>,
      },
    })
  } catch (error) {
    return error
  }
  return expect.unreachable()
}

const RETRIABLE_CASES: [string, HttpError][] = [
  [
    'Retry-After of 15s',
    makeHttpError({ status: 422, headers: { 'retry-after': '15' } }),
  ],
  [
    'Retry-After of exactly 12h',
    makeHttpError({
      status: 422,
      headers: { 'retry-after': `${TWELVE_HOURS_IN_SECONDS}` },
    }),
  ],
  ['status 504', makeHttpError({ status: 504 })],
  ['status 429', makeHttpError({ status: 429 })],
  ['ETIMEDOUT', makeHttpError({ message: 'connect ETIMEDOUT 10.0.0.1:443' })],
  ['ECONNRESET', makeHttpError({ message: 'read ECONNRESET' })],
]

const UNRETRIABLE_CASES: [string, HttpError][] = [
  ['status 400', makeHttpError({ status: 400 })],
  ['status 503', makeHttpError({ status: 503 })],
  [
    'Retry-After over 12h, even on a 429',
    makeHttpError({
      status: 429,
      headers: { 'retry-after': `${TWELVE_HOURS_IN_SECONDS + 1}` },
    }),
  ],
  ['ECONNREFUSED', makeHttpError({ message: 'connect ECONNREFUSED' })],
]

describe('isRetriableHttpError', () => {
  it.each(RETRIABLE_CASES)('retries on %s', (_, error) => {
    expect(isRetriableHttpError(error)).toBe(true)
  })

  it.each(UNRETRIABLE_CASES)('does not retry on %s', (_, error) => {
    expect(isRetriableHttpError(error)).toBe(false)
  })
})

describe('handleFailedStepAndThrow retry rules', () => {
  beforeEach(() => {
    addSpanTags.mockClear()
  })

  describe('agrees with isRetriableHttpError', () => {
    it.each([...RETRIABLE_CASES, ...UNRETRIABLE_CASES])(
      'for a raw HttpError and every StepError kind on %s',
      (_, httpError) => {
        const expected = isRetriableHttpError(httpError)
          ? RetriableError
          : UnrecoverableError
        const errors = [
          httpError,
          new StepError('n', 's', httpError),
          ...(['config', 'third-party', 'internal'] as const).map(
            (kind) =>
              new StepError({
                name: 'n',
                solution: 's',
                kind,
                cause: httpError,
              }),
          ),
        ]

        for (const error of errors) {
          expect(runWith(error)).toBeInstanceOf(expected)
        }
      },
    )
  })

  it('never retries a config StepError caused by an unretriable HTTP 400', () => {
    const error = makeConfigStepError(makeHttpError({ status: 400 }))

    expect(runWith(error)).toBeInstanceOf(UnrecoverableError)
    expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'false' })
  })

  it('never retries a config StepError without a cause', () => {
    const error = new StepError({ name: 'n', solution: 's', kind: 'config' })

    expect(runWith(error)).toBeInstanceOf(UnrecoverableError)
    expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'false' })
  })

  it('retries a config StepError caused by a retriable HTTP 429 while attempts remain', () => {
    const error = makeConfigStepError(makeHttpError({ status: 429 }))

    expect(runWith(error)).toBeInstanceOf(RetriableError)
    expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'true' })
  })

  it('keeps the config kind as a hidden cause on the final attempt', () => {
    const error = makeConfigStepError(makeHttpError({ status: 429 }))

    const thrown = runWith(error, MAXIMUM_JOB_ATTEMPTS - 1) as Error

    expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'false' })
    expect(thrown.cause).toBe(error)
    expect(getStepErrorKind(thrown.cause)).toBe('config')
  })

  it.each<StepErrorKind>(['third-party', 'internal'])(
    'still retries a %s StepError caused by a retriable HTTP error',
    (kind) => {
      const error = new StepError({
        name: 'n',
        solution: 's',
        kind,
        cause: makeHttpError({ status: 504 }),
      })

      expect(runWith(error)).toBeInstanceOf(RetriableError)
      expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'true' })
    },
  )

  it('still retries a StepError without kind caused by a retriable HTTP error', () => {
    const error = new StepError('n', 's', makeHttpError({ status: 504 }))

    expect(runWith(error)).toBeInstanceOf(RetriableError)
    expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'true' })
  })
})
