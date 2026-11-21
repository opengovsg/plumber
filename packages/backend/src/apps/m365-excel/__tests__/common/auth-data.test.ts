import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { extractAuthDataWithPlumberFolder } from '../../common/auth-data'

function makeGlobalVariable(auth: unknown): IGlobalVariable {
  return { auth } as unknown as IGlobalVariable
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
  it.each([
    ['the connection data is missing', { data: undefined }],
    ['the auth object is missing', undefined],
  ])('throws a config StepError when %s', (_, auth) => {
    const error = catchError(() =>
      extractAuthDataWithPlumberFolder(makeGlobalVariable(auth)),
    )

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
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
