/**
 * Business rules:
 * - "`kind: 'config'` never retries."
 * - "A `StepError` without `kind` keeps today's retry behavior."
 */
import type { IActionJobData, StepErrorKind } from '@plumber/types'
import { type JobPro, UnrecoverableError } from '@taskforcesh/bullmq-pro'
import type { AxiosError } from 'axios'
import { type Span } from 'dd-trace'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import { handleFailedStepAndThrow } from '../actions'

const addSpanTags = vi.fn()

const CONTEXT = {
  isQueueDelayable: false,
  span: { addTags: addSpanTags } as unknown as Span,
  worker: {} as never,
  job: { attemptsMade: 1 } as unknown as JobPro<IActionJobData>,
}

function makeHttpError(status: number): HttpError {
  return new HttpError({
    response: { status, headers: { 'retry-after': '15' } },
  } as unknown as AxiosError)
}

function runWith(executionError: unknown): unknown {
  try {
    handleFailedStepAndThrow({
      errorDetails: {},
      executionError,
      context: CONTEXT,
    })
  } catch (error) {
    return error
  }
  return expect.unreachable()
}

describe('handleFailedStepAndThrow retry rules', () => {
  beforeEach(() => {
    addSpanTags.mockClear()
  })

  it.each([429, 504])(
    'never retries a config StepError caused by a retriable HTTP %i',
    (status) => {
      const error = new StepError({
        name: 'n',
        solution: 's',
        kind: 'config',
        cause: makeHttpError(status),
      })

      expect(runWith(error)).toBeInstanceOf(UnrecoverableError)
      expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'false' })
    },
  )

  it.each<StepErrorKind>(['third-party', 'internal'])(
    'still retries a %s StepError caused by a retriable HTTP error',
    (kind) => {
      const error = new StepError({
        name: 'n',
        solution: 's',
        kind,
        cause: makeHttpError(504),
      })

      expect(runWith(error)).toBeInstanceOf(RetriableError)
      expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'true' })
    },
  )

  it('still retries a StepError without kind caused by a retriable HTTP error', () => {
    const error = new StepError('n', 's', makeHttpError(504))

    expect(runWith(error)).toBeInstanceOf(RetriableError)
    expect(addSpanTags).toHaveBeenCalledWith({ willRetry: 'true' })
  })
})
