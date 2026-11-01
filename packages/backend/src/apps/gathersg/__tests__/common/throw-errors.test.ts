import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { makeHttpError } from '../../../../../test/utils/make-http-error'
import throwGatherSGStepError from '../../common/throw-errors'

function gatherError(
  status: number | undefined,
  error?: Record<string, unknown>,
  code?: string,
) {
  return makeHttpError({
    status,
    data: error ? { error, traceId: 'trace-1' } : undefined,
    code,
  })
}

function catchStepError(error: ReturnType<typeof makeHttpError>): StepError {
  try {
    throwGatherSGStepError(error)
  } catch (thrown) {
    if (thrown instanceof StepError) {
      return thrown
    }
    throw thrown
  }
  throw new Error('throwGatherSGStepError did not throw')
}

function readName(error: StepError): string {
  return JSON.parse(error.message).name
}

describe('throwGatherSGStepError', () => {
  it.each([
    [
      '400 RESOURCE_NOT_FOUND (bad case status)',
      400,
      'RESOURCE_NOT_FOUND',
      'Status not found',
    ],
    ['422 INVALID_INPUT', 422, 'INVALID_INPUT', 'Invalid input'],
    ['403 UNAUTHORIZED', 403, 'UNAUTHORIZED', 'Unauthorized'],
    ['404 RESOURCE_NOT_FOUND', 404, 'RESOURCE_NOT_FOUND', 'Case not found'],
  ])('tags %s as config', (_label, status, code, message) => {
    const error = gatherError(status, { code, message, presentable: true })

    const stepError = catchStepError(error)

    expect(stepError.kind).toBe('config')
    expect(stepError.cause).toBe(error)
  })

  it('keeps the 422 field list in the name', () => {
    const error = gatherError(422, {
      code: 'INVALID_INPUT',
      message: 'Invalid input',
      details: { fields: ['Email', 'Phone'] },
    })

    expect(readName(catchStepError(error))).toBe(
      'Invalid or missing values for: Email, Phone',
    )
  })

  describe('catch-all', () => {
    it('tags 401 UNAUTHENTICATED as config', () => {
      const error = gatherError(401, {
        code: 'UNAUTHENTICATED',
        message:
          'You are unauthenticated. Please Login or contact $Support$ for help.',
        presentable: true,
      })

      const stepError = catchStepError(error)

      expect(stepError.kind).toBe('config')
      expect(readName(stepError)).toBe(
        'An error occurred: You are unauthenticated. Please Login or contact $Support$ for help.',
      )
    })

    it('tags 400 "Field is not eligible to upload." as config', () => {
      const error = gatherError(400, {
        details: "Applicant's CV",
        message: 'Field is not eligible to upload.',
        presentable: true,
      })

      const stepError = catchStepError(error)

      expect(stepError.kind).toBe('config')
      expect(readName(stepError)).toBe(
        'An error occurred: Field is not eligible to upload.',
      )
    })

    it.each([
      ['an unlisted 400', 400, { code: 'BAD_REQUEST', message: 'Bad' }],
      ['401 without UNAUTHENTICATED', 401, { message: 'Nope' }],
      ['403 without UNAUTHORIZED', 403, { code: 'FORBIDDEN', message: 'No' }],
      ['429', 429, { code: 'RATE_LIMITED', message: 'Slow down' }],
    ])('tags %s as internal', (_label, status, body) => {
      const stepError = catchStepError(gatherError(status, body))

      expect(stepError.kind).toBe('internal')
    })

    it('tags a 500 as third-party and keeps the cause', () => {
      const error = gatherError(500, { code: 'INTERNAL', message: 'Oops' })

      const stepError = catchStepError(error)

      expect(stepError.kind).toBe('third-party')
      expect(stepError.cause).toBe(error)
    })

    it('names an HTML 504 by its status', () => {
      const error = makeHttpError({
        status: 504,
        data: '<html>Gateway Timeout</html>',
      })

      const stepError = catchStepError(error)

      expect(stepError.kind).toBe('third-party')
      expect(stepError.cause).toBe(error)
      expect(readName(stepError)).toBe(
        'An error occurred: Ownself Gather returned HTTP 504',
      )
    })

    it('tags a network error as third-party', () => {
      const error = makeHttpError({
        message: 'read ECONNRESET',
        code: 'ECONNRESET',
      })

      const stepError = catchStepError(error)

      expect(stepError.kind).toBe('third-party')
      expect(readName(stepError)).toBe('An error occurred: read ECONNRESET')
    })

    it('tags a no-response error without a network code as internal', () => {
      const error = makeHttpError({ message: 'Missing API key' })

      const stepError = catchStepError(error)

      expect(stepError.kind).toBe('internal')
      expect(readName(stepError)).toBe('An error occurred: Missing API key')
    })
  })
})
