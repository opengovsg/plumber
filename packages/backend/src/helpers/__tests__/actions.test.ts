import type { IApp, IJSONObject } from '@plumber/types'

import type { AxiosError } from 'axios'
import { UnrecoverableError } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import Step from '@/models/step'

import { doesActionProcessFiles, handleErrorAndThrow } from '../actions'

vi.mock('@/apps', () => ({
  default: {
    'test-app': {
      key: 'test-app',
      actions: [
        { key: 'action1', doesFileProcessing: (_s: Step) => true },
        { key: 'action2', doesFileProcessing: (_s: Step) => false },
      ],
    } as IApp,
    'legacy-app': {
      key: 'legacy-app',
      actions: [{ key: 'action1' }],
    } as IApp,
  },
}))

describe('action helper functions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('file processing', () => {
    it('returns true for actions that process files', async () => {
      const result = await doesActionProcessFiles({
        appKey: 'test-app',
        key: 'action1',
      } as Step)
      expect(result).toEqual(true)
    })

    it('returns false for actions that do not process files', async () => {
      const result = await doesActionProcessFiles({
        appKey: 'test-app',
        key: 'action2',
      } as Step)
      expect(result).toEqual(false)
    })

    it('assumes that action does not process files if flag is not specified', async () => {
      const result = await doesActionProcessFiles({
        appKey: 'legacy-app',
        key: 'action1',
      } as Step)
      expect(result).toEqual(false)
    })

    it('returns false for actions that do not exist', async () => {
      const result = await doesActionProcessFiles({
        appKey: 'test-app',
        key: 'herp',
      } as Step)
      expect(result).toEqual(false)
    })

    it('returns false for apps that do not exist', async () => {
      const result = await doesActionProcessFiles({
        appKey: 'topkek',
        key: 'action1',
      } as Step)
      expect(result).toEqual(false)
    })
  })

  describe('error handling and retry', () => {
    const EMPTY_HTTP_ERROR = new HttpError({} as unknown as AxiosError)

    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it.each([
      { retryAfter: '31 Oct 2023 00:01:00 GMT', expectedResult: 60000 },
      { retryAfter: '15', expectedResult: 15000 },
    ])(
      'retries if valid Retry-After ($retryAfter) is in headers',
      ({ retryAfter, expectedResult }) => {
        vi.setSystemTime(new Date('31 Oct 2023 00:00:00 GMT'))

        const error = new HttpError({
          response: {
            headers: {
              'retry-after': retryAfter,
            },
          },
        } as unknown as AxiosError)

        try {
          handleErrorAndThrow({}, error)
        } catch (e) {
          expect(e instanceof RetriableError).toEqual(true)
          expect((e as RetriableError).delayInMs).toEqual(expectedResult)
        }
      },
    )

    it.each([
      { retryAfter: '31 Nov 2023 00:01:00 GMT' },
      { retryAfter: '2000000' },
    ])(
      'does not retry Retry-After ($retryAfter) if wait is too long',
      ({ retryAfter }) => {
        vi.setSystemTime(new Date('31 Oct 2023 00:00:00 GMT'))
        const error = new HttpError({
          response: {
            headers: {
              'retry-after': retryAfter,
            },
          },
        } as unknown as AxiosError)

        try {
          handleErrorAndThrow({}, error)
        } catch (e) {
          expect(e instanceof UnrecoverableError).toEqual(true)
          expect(
            (e as UnrecoverableError).message.endsWith('is too long!'),
          ).toEqual(true)
        }
      },
    )

    it.each([
      { retryAfter: '' },
      { retryAfter: 'not a date string derp' },
      { retryAfter: '-200' },
    ])(
      'does not retry Retry-After if value ("$retryAfter") is invalid',
      ({ retryAfter }) => {
        vi.setSystemTime(new Date('31 Oct 2023 00:00:00 GMT'))
        const error = new HttpError({
          response: {
            headers: {
              'retry-after': retryAfter,
            },
          },
        } as unknown as AxiosError)

        expect(() => handleErrorAndThrow({}, error)).toThrowError(
          UnrecoverableError,
        )
      },
    )

    it.each([504, 429])('retries some http status codes (%d)', (code) => {
      expect(() =>
        handleErrorAndThrow(
          {},
          new HttpError({
            response: {
              status: code,
            },
          } as unknown as AxiosError),
        ),
      ).toThrowError(RetriableError)
    })

    it.each([
      { details: { error: 'read ECONNRESET' } },
      { details: { error: 'connect ETIMEDOUT 1.2.3.4:123' } },
    ])(
      'retries errors with retriable messages ($details.error)',
      (errorDetails: IJSONObject) => {
        expect(() =>
          handleErrorAndThrow(errorDetails, EMPTY_HTTP_ERROR),
        ).toThrowError(RetriableError)
      },
    )

    it.each([
      {
        stepError: new StepError(
          'http-step-error',
          'test solution',
          1,
          'test-app',
          new HttpError({
            response: {
              headers: {
                'retry-after': '15',
              },
            },
          } as unknown as AxiosError),
        ),
        isRetried: true,
      },
      {
        stepError: new StepError(
          'non-http-step-error',
          'test solution',
          1,
          'test-app',
        ),
        isRetried: false,
      },
    ])('inspects the cause in StepError', ({ stepError, isRetried }) => {
      const expectedErrorType = isRetried ? RetriableError : UnrecoverableError
      expect(() => handleErrorAndThrow({}, stepError)).toThrowError(
        expectedErrorType,
      )
    })

    it.each([
      {
        errorDetails: {
          status: 500,
          details: { description: 'Internal Server Error' },
        },
        executionError: EMPTY_HTTP_ERROR,
      },
      {
        errorDetails: { error: 'connect ECONNREFUSED 1.2.3.4' },
        executionError: EMPTY_HTTP_ERROR,
      },
      {
        errorDetails: { error: 'no type for some reason' },
        executionError: EMPTY_HTTP_ERROR,
      },
      // Edge case: empty error details
      { errorDetails: {}, executionError: EMPTY_HTTP_ERROR },
      // Edge cases: non-error-type execution error
      {
        errorDetails: { error: 'loong was here' },
        executionError: 'some string',
      },
      {
        errorDetails: { error: 'loong was here' },
        executionError: 42,
      },
      {
        errorDetails: { error: 'loong was here' },
        executionError: null,
      },
      {
        errorDetails: { error: 'loong was here' },
        executionError: undefined,
      },
    ])(
      'does not retry other types of errors',
      ({
        errorDetails,
        executionError,
      }: {
        errorDetails: IJSONObject
        executionError: unknown
      }) => {
        expect(() =>
          handleErrorAndThrow(errorDetails, executionError),
        ).toThrowError(UnrecoverableError)
      },
    )
  })
})
