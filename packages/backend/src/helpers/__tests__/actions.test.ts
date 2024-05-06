import type { IActionJobData, IApp, IJSONObject } from '@plumber/types'

import {
  type JobPro,
  UnrecoverableError,
  WorkerPro,
} from '@taskforcesh/bullmq-pro'
import type { AxiosError } from 'axios'
import { type Span } from 'dd-trace'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import Step from '@/models/step'

import { doesActionProcessFiles, handleFailedStepAndThrow } from '../actions'

const mocks = vi.hoisted(() => ({
  workerRateLimit: vi.fn(),
  workerRateLimitGroup: vi.fn(),
  setExecutionStatus: vi.fn(),
  addSpanTags: vi.fn(),
}))

const MOCK_CONTEXT = {
  isQueuePausable: false,
  span: {
    addTags: mocks.addSpanTags,
  } as unknown as Span,
  worker: {
    rateLimit: mocks.workerRateLimit,
    rateLimitGroup: mocks.workerRateLimitGroup,
  } as unknown as WorkerPro<IActionJobData>,
  job: {
    attemptsMade: 1,
  } as unknown as JobPro<IActionJobData>,
} satisfies Parameters<typeof handleFailedStepAndThrow>[0]['context']

const BULLMQ_RATE_LIMIT_ERROR = WorkerPro.RateLimitError()

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

vi.mock('@/models/execution', () => ({
  default: {
    setStatus: mocks.setExecutionStatus,
  },
}))

describe('action helper functions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('doesActionProcessFiles', () => {
    it('returns true for actions that process files', () => {
      const result = doesActionProcessFiles({
        appKey: 'test-app',
        key: 'action1',
      } as Step)
      expect(result).toEqual(true)
    })

    it('returns false for actions that do not process files', () => {
      const result = doesActionProcessFiles({
        appKey: 'test-app',
        key: 'action2',
      } as Step)
      expect(result).toEqual(false)
    })

    it('assumes that action does not process files if flag is not specified', () => {
      const result = doesActionProcessFiles({
        appKey: 'legacy-app',
        key: 'action1',
      } as Step)
      expect(result).toEqual(false)
    })

    it('returns false for actions that do not exist', () => {
      const result = doesActionProcessFiles({
        appKey: 'test-app',
        key: 'herp',
      } as Step)
      expect(result).toEqual(false)
    })

    it('returns false for apps that do not exist', () => {
      const result = doesActionProcessFiles({
        appKey: 'topkek',
        key: 'action1',
      } as Step)
      expect(result).toEqual(false)
    })
  })

  describe('handleFailedStepAndThrow', () => {
    const EMPTY_HTTP_ERROR = new HttpError({} as unknown as AxiosError)

    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('HTTPError handling', () => {
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
            handleFailedStepAndThrow({
              errorDetails: {},
              executionError: error,
              context: MOCK_CONTEXT,
            })
          } catch (e) {
            if (!(e instanceof RetriableError)) {
              expect.unreachable()
            }
            expect(e.delayInMs).toEqual(expectedResult)
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
            handleFailedStepAndThrow({
              errorDetails: {},
              executionError: error,
              context: MOCK_CONTEXT,
            })
          } catch (e) {
            if (!(e instanceof UnrecoverableError)) {
              expect.unreachable()
            }
            expect(e.message.endsWith('is too long!')).toEqual(true)
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

          expect(() =>
            handleFailedStepAndThrow({
              errorDetails: {},
              executionError: error,
              context: MOCK_CONTEXT,
            }),
          ).toThrowError(UnrecoverableError)
        },
      )

      it.each([504, 429])('retries some http status codes (%d)', (code) => {
        const error = new HttpError({
          response: {
            status: code,
          },
        } as unknown as AxiosError)
        expect(() =>
          handleFailedStepAndThrow({
            errorDetails: {},
            executionError: error,
            context: MOCK_CONTEXT,
          }),
        ).toThrowError(RetriableError)
      })

      it.each([
        { details: { error: 'read ECONNRESET' } },
        { details: { error: 'connect ETIMEDOUT 1.2.3.4:123' } },
      ])(
        'retries errors with retriable messages ($details.error)',
        (errorDetails: IJSONObject) => {
          expect(() =>
            handleFailedStepAndThrow({
              errorDetails: errorDetails,
              executionError: EMPTY_HTTP_ERROR,
              context: MOCK_CONTEXT,
            }),
          ).toThrowError(RetriableError)
        },
      )
    })

    describe('RetriableError handling', () => {
      it('pauses the queue if delayType is queue and the queue is pausable', () => {
        try {
          handleFailedStepAndThrow({
            errorDetails: {},
            executionError: new RetriableError({
              error: 'test error',
              delayInMs: 100,
              delayType: 'queue',
            }),
            context: {
              ...MOCK_CONTEXT,
              isQueuePausable: true,
            },
          })
        } catch (e) {
          expect(e.name).toEqual(BULLMQ_RATE_LIMIT_ERROR.name)
          expect(e.message).toEqual(BULLMQ_RATE_LIMIT_ERROR.message)

          expect(mocks.workerRateLimit).toBeCalledWith(100)
          expect(mocks.workerRateLimitGroup).not.toBeCalled()
        }
      })

      it('does not pause the queue if delayType is queue but queue is not pausable', () => {
        expect(() =>
          handleFailedStepAndThrow({
            errorDetails: {},
            executionError: new RetriableError({
              error: 'test error',
              delayInMs: 100,
              delayType: 'queue',
            }),
            context: MOCK_CONTEXT,
          }),
        ).toThrow(RetriableError)

        expect(mocks.workerRateLimit).not.toBeCalled()
        expect(mocks.workerRateLimitGroup).not.toBeCalled()
      })

      it("pauses the job's group if delayType is group", () => {
        const job = {
          opts: {
            group: {
              id: 'test-group',
            },
          },
        } as unknown as JobPro<IActionJobData>

        try {
          handleFailedStepAndThrow({
            errorDetails: {},
            executionError: new RetriableError({
              error: 'test error',
              delayInMs: 100,
              delayType: 'group',
            }),
            context: {
              ...MOCK_CONTEXT,
              job,
            },
          })
        } catch (e) {
          expect(e.name).toEqual(BULLMQ_RATE_LIMIT_ERROR.name)
          expect(e.message).toEqual(BULLMQ_RATE_LIMIT_ERROR.message)

          expect(mocks.workerRateLimitGroup).toBeCalledWith(job, 100)
          expect(mocks.workerRateLimit).not.toBeCalled()
        }
      })

      it('does not pause the group if delayType is group but job does not have a group', () => {
        expect(() =>
          handleFailedStepAndThrow({
            errorDetails: {},
            executionError: new RetriableError({
              error: 'test error',
              delayInMs: 100,
              delayType: 'group',
            }),
            context: MOCK_CONTEXT,
          }),
        ).toThrow(RetriableError)

        expect(mocks.workerRateLimit).not.toBeCalled()
        expect(mocks.workerRateLimitGroup).not.toBeCalled()
      })

      it('throws the original RetriableError if delayType is step', () => {
        const error = new RetriableError({
          error: 'test error',
          delayInMs: 100,
          delayType: 'group',
        })

        expect(() =>
          handleFailedStepAndThrow({
            errorDetails: {},
            executionError: error,
            context: {
              ...MOCK_CONTEXT,
            },
          }),
        ).toThrow(error)
      })
    })

    describe('other error type handling', () => {
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
      ])(
        'unpacks the original error if it gets a StepError',
        ({ stepError, isRetried }) => {
          const expectedErrorType = isRetried
            ? RetriableError
            : UnrecoverableError
          expect(() =>
            handleFailedStepAndThrow({
              errorDetails: {},
              executionError: stepError,
              context: MOCK_CONTEXT,
            }),
          ).toThrowError(expectedErrorType)
        },
      )

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
            handleFailedStepAndThrow({
              errorDetails,
              executionError,
              context: MOCK_CONTEXT,
            }),
          ).toThrowError(UnrecoverableError)
        },
      )
    })

    describe('context updating', () => {
      it.each([
        {
          executionError: new RetriableError({
            error: 'test error',
            delayInMs: 100,
            delayType: 'step',
          }),
          expectedTagValue: 'true',
        },
        {
          executionError: new UnrecoverableError('topkek'),
          expectedTagValue: 'false',
        },
      ])(
        'adds the appropriate willRetry tag to the span',
        ({ executionError, expectedTagValue }) => {
          expect(() =>
            handleFailedStepAndThrow({
              errorDetails: {},
              executionError,
              context: MOCK_CONTEXT,
            }),
          ).toThrow()
          expect(mocks.addSpanTags).toBeCalledWith({
            willRetry: expectedTagValue,
          })
        },
      )
    })
  })
})
