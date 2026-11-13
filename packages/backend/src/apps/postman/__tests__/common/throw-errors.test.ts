import { IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import { makeHttpError } from '../../../../../test/utils/make-http-error'
import { throwPostmanStepError } from '../../common/throw-errors'

vi.mock('../../common/send-blacklist-email', () => ({
  createRequestBlacklistFormLink: vi.fn(() => 'https://form.example'),
}))

function makeGlobal(testRun = false): IGlobalVariable {
  return {
    user: { email: 'tester@open.gov.sg' },
    execution: { id: 'execution-1', testRun },
    step: { id: 'step-1' },
    flow: { id: 'flow-1' },
  } as unknown as IGlobalVariable
}

function makeSesError(
  name: string,
  message = 'SES error',
  { code, httpStatusCode }: { code?: string; httpStatusCode?: number } = {},
): Error {
  const error = new Error(message)
  error.name = name
  if (code !== undefined) {
    Object.assign(error, { code })
  }
  if (httpStatusCode !== undefined) {
    Object.assign(error, { $metadata: { httpStatusCode } })
  }
  return error
}

type ThrowParams = Parameters<typeof throwPostmanStepError>[0]

function catchThrown(
  params: Partial<ThrowParams> & Pick<ThrowParams, 'status' | 'error'>,
): unknown {
  try {
    throwPostmanStepError({
      $: makeGlobal(),
      isPartialSuccess: false,
      blacklistedRecipients: [],
      invalidAttachments: [],
      isRetryWithoutAttachments: false,
      ...params,
    })
  } catch (thrown) {
    return thrown
  }
  throw new Error('throwPostmanStepError did not throw')
}

function readName(error: StepError): string {
  return JSON.parse(error.message).name
}

const postmanBlacklisted = () =>
  makeHttpError({
    status: 400,
    data: {
      code: 'invalid_template',
      message: 'Recipient email is blacklisted',
    },
  })

describe('throwPostmanStepError', () => {
  describe('config', () => {
    it.each([
      ['a Postman 400', postmanBlacklisted()],
      [
        'the SES suppression list stub',
        { message: 'Email address is in suppression list' } as HttpError,
      ],
    ])('tags all recipients blacklisted by %s as config', (_label, error) => {
      const thrown = catchThrown({
        status: 'BLACKLISTED',
        error,
        blacklistedRecipients: ['blocked@example.com'],
      })

      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).not.toBeInstanceOf(PartialStepError)
      expect(thrown).toMatchObject({ kind: 'config', cause: error })
      expect(readName(thrown as StepError)).toBe('Blacklisted recipient email')
    })

    it('tags some recipients blacklisted as a config PartialStepError', () => {
      const thrown = catchThrown({
        status: 'BLACKLISTED',
        error: postmanBlacklisted(),
        isPartialSuccess: true,
        blacklistedRecipients: ['blocked@example.com'],
      })

      expect(thrown).toBeInstanceOf(PartialStepError)
      expect(thrown).toMatchObject({ kind: 'config' })
    })

    it('tags a password-protected attachment as config', () => {
      const error = makeHttpError({
        status: 400,
        data: { code: 'invalid_template', message: 'bad attachments' },
      })

      const thrown = catchThrown({ status: 'INVALID-ATTACHMENT', error })

      expect(thrown).toMatchObject({ kind: 'config', cause: error })
      expect(readName(thrown as StepError)).toBe(
        'Password-protected attachment(s)',
      )
    })

    it.each([
      [
        'Postman attachment_limit',
        makeHttpError({ status: 400, data: { code: 'attachment_limit' } }),
      ],
      [
        'SES AttachmentSizeExceededError',
        makeSesError('AttachmentSizeExceededError') as HttpError,
      ],
    ])('tags %s as config', (_label, error) => {
      const thrown = catchThrown({ status: 'ATTACHMENT-SIZE-EXCEEDED', error })

      expect(thrown).toMatchObject({ kind: 'config', cause: error })
      expect(readName(thrown as StepError)).toBe(
        'Total attachment size exceeded',
      )
    })

    it('tags invalid attachments in a test run as a config StepError', () => {
      const error = makeHttpError({ status: 503 })

      const thrown = catchThrown({
        $: makeGlobal(true),
        status: 'ERROR',
        error,
        invalidAttachments: ['virus.exe'],
      })

      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).not.toBeInstanceOf(PartialStepError)
      expect(thrown).toMatchObject({ kind: 'config', cause: error })
      expect(readName(thrown as StepError)).toBe('Invalid attachment(s)')
    })

    it('tags invalid attachments outside a test run as a config PartialStepError', () => {
      const thrown = catchThrown({
        status: 'ERROR',
        error: undefined,
        invalidAttachments: ['virus.exe'],
      })

      expect(thrown).toBeInstanceOf(PartialStepError)
      expect(thrown).toMatchObject({ kind: 'config' })
    })
  })

  describe('catch-all', () => {
    it.each([
      ['a Postman 503', makeHttpError({ status: 503 })],
      ['a Postman 500', makeHttpError({ status: 500 })],
      [
        'a network error with no status',
        makeHttpError({ code: 'ECONNREFUSED', message: 'connect refused' }),
      ],
      [
        'a reset connection with no status',
        makeHttpError({ code: 'ECONNRESET', message: 'read ECONNRESET' }),
      ],
      [
        'a DNS failure with no status',
        makeHttpError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' }),
      ],
      [
        'an SES TimeoutError',
        makeSesError('TimeoutError', 'read ECONNRESET', { code: 'ECONNRESET' }),
      ],
      [
        'an SES DNS failure',
        makeSesError('Error', 'getaddrinfo ENOTFOUND', { code: 'ENOTFOUND' }),
      ],
    ])('tags %s as third-party and keeps the cause', (_label, error) => {
      const thrown = catchThrown({ status: 'ERROR', error: error as HttpError })

      expect(thrown).toMatchObject({ kind: 'third-party', cause: error })
      expect(readName(thrown as StepError)).toBe('Something went wrong')
    })

    it.each([
      [
        'a Postman 401',
        makeHttpError({
          status: 401,
          code: 'ERR_BAD_REQUEST',
          data: { code: 'unauthenticated' },
        }),
      ],
      [
        'a Postman 400 invalid_template',
        makeHttpError({
          status: 400,
          code: 'ERR_BAD_REQUEST',
          data: { code: 'invalid_template', message: 'Unknown error' },
        }),
      ],
      [
        'an HttpError with no status and no code',
        makeHttpError({ message: 'thrown in beforeRequest' }),
      ],
      [
        'an axios request error with no status',
        makeHttpError({
          code: 'ERR_BAD_REQUEST',
          message: 'Unsupported protocol',
        }),
      ],
      [
        'a cancelled request',
        makeHttpError({ code: 'ERR_CANCELED', message: 'canceled' }),
      ],
      [
        'SES MessageRejected',
        makeSesError('MessageRejected', 'Email address is not verified.', {
          httpStatusCode: 400,
        }),
      ],
      [
        'an SES error with a network code and a status',
        makeSesError('Error', 'read ECONNRESET', {
          code: 'ECONNRESET',
          httpStatusCode: 400,
        }),
      ],
      ['SES SendingPausedException', makeSesError('SendingPausedException')],
      [
        'SES AccountSuspendedException',
        makeSesError('AccountSuspendedException'),
      ],
      ['a plain Error', new Error('failed to build MIME')],
    ])('tags %s as internal', (_label, error) => {
      const thrown = catchThrown({ status: 'ERROR', error: error as HttpError })

      expect(thrown).toMatchObject({ kind: 'internal', cause: error })
      expect(readName(thrown as StepError)).toBe('Something went wrong')
    })
  })

  it.each([
    ['RATE-LIMITED' as const, makeHttpError({ status: 429 })],
    ['INTERMITTENT-ERROR' as const, makeHttpError({ status: 502 })],
    [
      'ERROR' as const,
      makeHttpError({ code: 'ECONNRESET', message: 'socket hang up' }),
    ],
  ])('keeps %s as a RetriableError', (status, error) => {
    expect(catchThrown({ status, error })).toBeInstanceOf(RetriableError)
  })
})
