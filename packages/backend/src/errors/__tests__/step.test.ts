import type { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import HttpError from '../http'
import StepError from '../step'

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
