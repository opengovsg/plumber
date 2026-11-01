import { describe, expect, it } from 'vitest'

import { makeHttpError } from '@/../test/utils/make-http-error'
import StepError from '@/errors/step'

import {
  rethrowAsGraphStepError,
  toGraphStepError,
} from '../../common/graph-http-error'

function graphError(status: number, code: string) {
  return makeHttpError({
    status,
    data: { error: { code, message: `${code} message` } },
  })
}

describe('toGraphStepError', () => {
  it.each([
    [404, 'itemNotFound'],
    [413, 'requestTooLarge'],
    [501, 'FileCorruptTryRepair'],
    [400, 'RangeExceedsLimit'],
  ])('maps %i %s to config', (status, code) => {
    const httpError = graphError(status, code)
    const stepError = toGraphStepError(httpError)
    expect(stepError).toBeInstanceOf(StepError)
    expect(stepError.kind).toBe('config')
    expect(stepError.cause).toBe(httpError)
  })

  it('keeps the existing name for a table that exceeds the range limit', () => {
    const stepError = toGraphStepError(graphError(400, 'RangeExceedsLimit'))
    expect(JSON.parse(stepError.message)).toMatchObject({
      name: 'Your Excel table is too large',
      solution: 'Reduce the number of rows or columns and try again.',
    })
  })

  it.each([
    [400, 'InvalidArgument'],
    [401, 'InvalidAuthenticationToken'],
    [405, 'MethodNotAllowed'],
  ])('maps %i %s to internal', (status, code) => {
    const httpError = graphError(status, code)
    const stepError = toGraphStepError(httpError)
    expect(stepError.kind).toBe('internal')
    expect(stepError.cause).toBe(httpError)
  })

  it('maps a 400 without a Graph error body to internal', () => {
    const stepError = toGraphStepError(makeHttpError({ status: 400 }))
    expect(stepError.kind).toBe('internal')
  })

  it.each([
    [403, 'AccessDenied'],
    [409, 'InsertDeleteConflict'],
    [505, 'HttpVersionNotSupported'],
    [507, 'InsufficientStorage'],
  ])('maps %i %s to third-party', (status, code) => {
    const httpError = graphError(status, code)
    const stepError = toGraphStepError(httpError)
    expect(stepError.kind).toBe('third-party')
    expect(stepError.cause).toBe(httpError)
  })

  it('maps a network error to third-party', () => {
    const httpError = makeHttpError({
      code: 'ECONNABORTED',
      message: 'timeout of 180000ms exceeded',
    })
    const stepError = toGraphStepError(httpError)
    expect(stepError.kind).toBe('third-party')
    expect(stepError.cause).toBe(httpError)
  })

  it('maps a no-response error without a code to internal', () => {
    // e.g. a token fetch failure thrown from beforeRequest.
    const httpError = makeHttpError({ message: 'Invalid tenant key' })
    const stepError = toGraphStepError(httpError)
    expect(stepError.kind).toBe('internal')
    expect(stepError.cause).toBe(httpError)
  })
})

describe('rethrowAsGraphStepError', () => {
  it('converts an HttpError', () => {
    const httpError = graphError(404, 'itemNotFound')
    expect(() => rethrowAsGraphStepError(httpError)).toThrow(StepError)
  })

  it('rethrows any other error unchanged', () => {
    const error = new Error('boom')
    expect(() => rethrowAsGraphStepError(error)).toThrow(error)
  })
})
