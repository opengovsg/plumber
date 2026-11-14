import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { makeHttpError } from '../../../../../test/utils/make-http-error'
import { rethrowAsPaySgStepError } from '../../common/paysg-http-error'

function catchError(error: unknown): unknown {
  try {
    rethrowAsPaySgStepError(error)
  } catch (thrown) {
    return thrown
  }
  throw new Error('expected rethrowAsPaySgStepError to throw')
}

describe('rethrowAsPaySgStepError', () => {
  it.each([400, 401, 402, 403, 404])(
    'maps a %i response to a config StepError',
    (status) => {
      const httpError = makeHttpError({ status })
      const thrown = catchError(httpError)

      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).toMatchObject({ kind: 'config', cause: httpError })
    },
  )

  it.each([409, 422, 429])(
    'maps a %i response to an internal StepError',
    (status) => {
      const httpError = makeHttpError({ status })

      expect(catchError(httpError)).toMatchObject({
        kind: 'internal',
        cause: httpError,
      })
    },
  )

  it.each([500, 502, 503, 504])(
    'maps a %i response to a third-party StepError',
    (status) => {
      const httpError = makeHttpError({ status })

      expect(catchError(httpError)).toMatchObject({
        kind: 'third-party',
        cause: httpError,
      })
    },
  )

  it('maps a network error with no response to third-party', () => {
    const httpError = makeHttpError({ code: 'ECONNRESET' })

    expect(catchError(httpError)).toMatchObject({
      kind: 'third-party',
      cause: httpError,
    })
  })

  it('maps a DNS failure with no response to third-party', () => {
    const httpError = makeHttpError({ code: 'ENOTFOUND' })

    expect(catchError(httpError)).toMatchObject({ kind: 'third-party' })
  })

  it.each(['ERR_BAD_REQUEST', 'ERR_CANCELED'])(
    'maps a %s request error with no response to internal',
    (code) => {
      const httpError = makeHttpError({ code })

      expect(catchError(httpError)).toMatchObject({
        kind: 'internal',
        cause: httpError,
      })
    },
  )

  it('maps a beforeRequest failure (no status, no code) to internal', () => {
    const httpError = makeHttpError({ message: 'Missing API key' })

    expect(catchError(httpError)).toMatchObject({
      kind: 'internal',
      cause: httpError,
    })
  })

  it("includes PaySG's error message in a 400 name", () => {
    const httpError = makeHttpError({
      status: 400,
      data: {
        error: {
          type: 'invalid_request_error',
          code: 'invalid_amount',
          message: 'amount_in_cents must not exceed 20000000',
        },
      },
    })

    expect(catchError(httpError)).toMatchObject({
      kind: 'config',
      message: expect.stringContaining(
        'amount_in_cents must not exceed 20000000',
      ),
    })
  })

  it('rethrows a non-HttpError unchanged', () => {
    const error = new Error('boom')

    expect(catchError(error)).toBe(error)
  })

  it('rethrows an existing StepError unchanged', () => {
    const error = new StepError({
      name: 'already wrapped',
      solution: 'n/a',
      kind: 'config',
    })

    expect(catchError(error)).toBe(error)
  })
})
