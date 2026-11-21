import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import { extractAuthDataWithPlumberFolder } from '../../common/auth-data'

const mocks = vi.hoisted(() => ({ loggerError: vi.fn() }))

vi.mock('@/helpers/logger', () => ({
  default: { error: mocks.loggerError, info: vi.fn(), warn: vi.fn() },
}))

function makeGlobalVariable(auth: unknown): IGlobalVariable {
  return {
    auth,
    flow: { id: 'flow-id' },
    step: { id: 'step-id' },
    execution: { id: 'execution-id' },
  } as unknown as IGlobalVariable
}

function catchError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  throw new Error('Expected an error to be thrown')
}

describe('m365-excel extractAuthDataWithPlumberFolder', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it.each([
    ['the connection data is missing', { data: undefined }],
    ['the auth object is missing', undefined],
  ])('throws a config StepError when %s', (_, auth) => {
    const error = catchError(() =>
      extractAuthDataWithPlumberFolder(makeGlobalVariable(auth)),
    )

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
    expect(mocks.loggerError).not.toHaveBeenCalled()
  })

  it.each([
    ['the tenant key is unknown', { tenantKey: 'nope', folderId: 'folder' }],
    ['the folder id is missing', { tenantKey: 'sg-govt' }],
  ])('throws an internal StepError when %s', (_, data) => {
    const error = catchError(() =>
      extractAuthDataWithPlumberFolder(makeGlobalVariable({ data })),
    )

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'internal' })
  })

  it('shows and logs the failing field when the auth data is malformed', () => {
    const expectedMessage =
      '✖ Invalid input: expected string, received undefined\n  → at folderId'

    const error = catchError(() =>
      extractAuthDataWithPlumberFolder(
        makeGlobalVariable({ data: { tenantKey: 'sg-govt' } }),
      ),
    ) as StepError

    expect(JSON.parse(error.message).details).toEqual({
      error: expectedMessage,
    })
    expect(mocks.loggerError).toHaveBeenCalledOnce()
    expect(mocks.loggerError.mock.calls[0][1]).toEqual({
      event: 'm365-excel-malformed-auth-data',
      errorName: 'ZodError',
      errorMessage: expectedMessage,
      flowId: 'flow-id',
      stepId: 'step-id',
      executionId: 'execution-id',
    })
  })

  it('returns the auth data with an upper-cased folder id', () => {
    expect(
      extractAuthDataWithPlumberFolder(
        makeGlobalVariable({
          data: { tenantKey: 'sg-govt', folderId: 'folder-1' },
        }),
      ),
    ).toEqual({ tenantKey: 'sg-govt', folderId: 'FOLDER-1' })
  })
})
