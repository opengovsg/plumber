/**
 * Business rule:
 * - "Every failure of the user's own endpoint is `config`, including 429."
 */
import type { IActionJobData, IGlobalVariable } from '@plumber/types'
import { type JobPro } from '@taskforcesh/bullmq-pro'
import { type Span } from 'dd-trace'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError, { getStepErrorKind } from '@/errors/step'
import { handleFailedStepAndThrow } from '@/helpers/actions'
import { MAXIMUM_JOB_ATTEMPTS } from '@/helpers/default-job-configuration'

import app from '../..'
import { makeHttpError } from '../../../../../test/utils/make-http-error'
import makeRequestAction from '../../actions/http-request'

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
}))

vi.mock('../../common/ip-resolver', () => ({
  safeAxiosLookup: vi.fn(),
}))

vi.mock('../../common/add-interceptors', () => ({
  default: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: () => ({
        throwIfNotFound: () => ({ config: {} }),
      }),
    }),
  },
}))

const ENDPOINT_FAILURES: [string, HttpError][] = [
  ['400', makeHttpError({ status: 400, statusText: 'Bad Request' })],
  ['401', makeHttpError({ status: 401, statusText: 'Unauthorized' })],
  ['403', makeHttpError({ status: 403, statusText: 'Forbidden' })],
  ['404', makeHttpError({ status: 404, statusText: 'Not Found' })],
  ['429', makeHttpError({ status: 429, statusText: 'Too Many Requests' })],
  [
    '422 with Retry-After',
    makeHttpError({ status: 422, headers: { 'retry-after': '5' } }),
  ],
  ['500', makeHttpError({ status: 500, statusText: 'Internal Server Error' })],
  ['502', makeHttpError({ status: 502, statusText: 'Bad Gateway' })],
  ['503', makeHttpError({ status: 503, statusText: 'Service Unavailable' })],
  ['504', makeHttpError({ status: 504, statusText: 'Gateway Timeout' })],
  [
    'ECONNRESET',
    makeHttpError({ message: 'read ECONNRESET', code: 'ECONNRESET' }),
  ],
  [
    'ETIMEDOUT',
    makeHttpError({
      message: 'connect ETIMEDOUT 10.0.0.1:443',
      code: 'ETIMEDOUT',
    }),
  ],
  [
    'ECONNREFUSED',
    makeHttpError({
      message: 'connect ECONNREFUSED 10.0.0.1:443',
      code: 'ECONNREFUSED',
    }),
  ],
  [
    'an expired TLS certificate',
    makeHttpError({
      message: 'certificate has expired',
      code: 'CERT_HAS_EXPIRED',
    }),
  ],
  [
    'a DNS failure',
    makeHttpError({ message: 'Unable to resolve IP address for nope.test' }),
  ],
  [
    'a response over 2 MB',
    makeHttpError({
      status: 413,
      statusText: 'Payload Too Large',
      message: 'Response body size exceeds maximum allowed size (2MB)',
    }),
  ],
]

describe('custom-api http request: user endpoint failures', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      step: {
        id: 'step-id',
        appKey: 'custom-api',
        key: 'httpRequest',
        position: 1,
        parameters: { method: 'GET', url: 'https://example.test' },
      },
      http: {
        request: mocks.httpRequest,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function runAndCatch(): Promise<StepError> {
    const error = await makeRequestAction.run($).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StepError)
    return error as StepError
  }

  it.each(ENDPOINT_FAILURES)('marks %s as config', async (_, httpError) => {
    mocks.httpRequest.mockRejectedValueOnce(httpError)

    const error = await runAndCatch()

    expect(error).toMatchObject({ kind: 'config', cause: httpError })
  })

  it('marks a non-2xx on the redirect hop as config', async () => {
    const httpError = makeHttpError({ status: 302, statusText: 'Found' })
    mocks.httpRequest
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: 'https://redirect.test' },
      })
      .mockRejectedValueOnce(httpError)

    const error = await runAndCatch()

    expect(error).toMatchObject({ kind: 'config', cause: httpError })
  })

  it('keeps retrying a 429 from the endpoint, then fails as config', async () => {
    mocks.httpRequest.mockRejectedValue(
      makeHttpError({ status: 429, statusText: 'Too Many Requests' }),
    )
    const executionError = await runAndCatch()

    const runWith = (attemptsMade: number): unknown => {
      try {
        handleFailedStepAndThrow({
          errorDetails: {},
          executionError,
          context: {
            isQueueDelayable: false,
            span: { addTags: vi.fn() } as unknown as Span,
            worker: {} as never,
            job: { attemptsMade } as unknown as JobPro<IActionJobData>,
          },
        })
      } catch (error) {
        return error
      }
      return expect.unreachable()
    }

    expect(runWith(0)).toBeInstanceOf(RetriableError)
    const finalError = runWith(MAXIMUM_JOB_ATTEMPTS - 1) as Error
    expect(getStepErrorKind(finalError.cause)).toBe('config')
  })
})
