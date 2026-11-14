import {
  AccountSuspendedException,
  InternalServiceErrorException,
  MessageRejected,
  SendingPausedException,
  SESv2ServiceException,
  TooManyRequestsException,
} from '@aws-sdk/client-sesv2'
import { IGlobalVariable } from '@plumber/types'
import { ServiceException } from '@smithy/smithy-client'
import { describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import { makeHttpError } from '../../../../../test/utils/make-http-error'
import {
  getSesErrorStatus,
  throwPostmanStepError,
} from '../../common/throw-errors'

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

function makeNamedError(name: string, message: string, code?: string): Error {
  const error = new Error(message)
  error.name = name
  if (code !== undefined) {
    Object.assign(error, { code })
  }
  return error
}

function makeMessageRejected(message: string): MessageRejected {
  return new MessageRejected({ message, $metadata: { httpStatusCode: 400 } })
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
        makeNamedError('AttachmentSizeExceededError', 'too big') as HttpError,
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
        makeNamedError('TimeoutError', 'read ECONNRESET', 'ECONNRESET'),
      ],
      [
        'an SES DNS failure',
        makeNamedError('Error', 'getaddrinfo ENOTFOUND', 'ENOTFOUND'),
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
        makeMessageRejected('Email address is not verified.'),
      ],
      [
        'an SES error with a network code and a status',
        Object.assign(makeMessageRejected('read ECONNRESET'), {
          code: 'ECONNRESET',
        }),
      ],
      [
        'SES SendingPausedException',
        new SendingPausedException({
          message: 'Sending paused',
          $metadata: { httpStatusCode: 400 },
        }),
      ],
      [
        'SES AccountSuspendedException',
        new AccountSuspendedException({
          message: 'Account suspended',
          $metadata: { httpStatusCode: 400 },
        }),
      ],
      ['a plain Error', new Error('failed to build MIME')],
    ])('tags %s as internal', (_label, error) => {
      const thrown = catchThrown({ status: 'ERROR', error: error as HttpError })

      expect(thrown).toMatchObject({ kind: 'internal', cause: error })
      expect(readName(thrown as StepError)).toBe('Something went wrong')
      expect((thrown as StepError).message).toContain(
        '"solution":"Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance."',
      )
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

describe('getSesErrorStatus', () => {
  it.each([
    [
      'TooManyRequestsException',
      new TooManyRequestsException({
        message: 'Maximum sending rate exceeded.',
        $metadata: { httpStatusCode: 429 },
      }),
    ],
    [
      'an unmodeled ThrottlingException',
      new SESv2ServiceException({
        name: 'ThrottlingException',
        $fault: 'client',
        message: 'Rate exceeded',
        $metadata: { httpStatusCode: 400 },
      }),
    ],
    [
      'an unmodeled 429',
      new SESv2ServiceException({
        name: 'UnknownError',
        $fault: 'client',
        message: 'Too many requests',
        $metadata: { httpStatusCode: 429 },
      }),
    ],
  ])('returns RATE-LIMITED for %s', (_label, error) => {
    expect(getSesErrorStatus(error)).toBe('RATE-LIMITED')
  })

  it('returns INTERMITTENT-ERROR for an SES 500', () => {
    const error = new InternalServiceErrorException({
      message: 'Internal failure',
      $metadata: { httpStatusCode: 500 },
    })

    expect(getSesErrorStatus(error)).toBe('INTERMITTENT-ERROR')
  })

  // The SES client fetches credentials from STS, whose errors are not SESv2ServiceExceptions.
  it('returns INTERMITTENT-ERROR for an STS 500', () => {
    const error = new ServiceException({
      name: 'InternalFailure',
      $fault: 'server',
      message: 'STS internal failure',
      $metadata: { httpStatusCode: 500 },
    })

    expect(getSesErrorStatus(error)).toBe('INTERMITTENT-ERROR')
  })

  it('returns RATE-LIMITED for an STS ThrottlingException', () => {
    const error = new ServiceException({
      name: 'ThrottlingException',
      $fault: 'client',
      message: 'Rate exceeded',
      $metadata: { httpStatusCode: 400 },
    })

    expect(getSesErrorStatus(error)).toBe('RATE-LIMITED')
  })

  it.each([
    'Address blacklisted.',
    'Email address is on the account suppression list.',
  ])('returns BLACKLISTED for MessageRejected "%s"', (message) => {
    expect(getSesErrorStatus(makeMessageRejected(message))).toBe('BLACKLISTED')
  })

  it('returns ATTACHMENT-SIZE-EXCEEDED for AttachmentSizeExceededError', () => {
    const error = makeNamedError('AttachmentSizeExceededError', 'too big')

    expect(getSesErrorStatus(error)).toBe('ATTACHMENT-SIZE-EXCEEDED')
  })

  it.each([
    [
      'MessageRejected without a blacklist reason',
      makeMessageRejected('Email address is not verified.'),
    ],
    [
      'SendingPausedException',
      new SendingPausedException({
        message: 'Sending paused',
        $metadata: { httpStatusCode: 400 },
      }),
    ],
    [
      'a plain Error named MessageRejected',
      makeNamedError('MessageRejected', 'Address blacklisted.'),
    ],
    [
      'a plain Error named TooManyRequestsException',
      makeNamedError('TooManyRequestsException', 'SES error'),
    ],
    [
      'a plain Error with a 429 status',
      Object.assign(new Error('SES error'), {
        $metadata: { httpStatusCode: 429 },
      }),
    ],
    ['a non-Error', 'boom'],
  ])('returns ERROR for %s', (_label, error) => {
    expect(getSesErrorStatus(error)).toBe('ERROR')
  })
})
