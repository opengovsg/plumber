import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import StepError from '@/errors/step'

import {
  extractAuthDataWithPlumberFolder,
  parseAuthData,
} from '../../common/auth-data'

function makeGlobalVariable(auth: unknown): IGlobalVariable {
  return { auth } as unknown as IGlobalVariable
}

describe('m365-excel parseAuthData', () => {
  it.each([
    ['the connection data is missing', { data: undefined }],
    ['the auth object is missing', undefined],
  ])('returns missing when %s', (_, auth) => {
    expect(parseAuthData(makeGlobalVariable(auth))).toEqual({
      status: 'missing',
    })
  })

  it.each([
    ['the tenant key is unknown', { tenantKey: 'nope', folderId: 'folder' }],
    ['the folder id is missing', { tenantKey: 'sg-govt' }],
  ])('returns malformed with the ZodError when %s', (_, data) => {
    const result = parseAuthData(makeGlobalVariable({ data }))

    expect(result.status).toBe('malformed')
    expect(result).toMatchObject({ error: expect.any(z.ZodError) })
  })

  it('returns the auth data with an upper-cased folder id', () => {
    expect(
      parseAuthData(
        makeGlobalVariable({
          data: { tenantKey: 'sg-govt', folderId: 'folder-1' },
        }),
      ),
    ).toEqual({
      status: 'ok',
      data: { tenantKey: 'sg-govt', folderId: 'FOLDER-1' },
    })
  })
})

describe('m365-excel extractAuthDataWithPlumberFolder', () => {
  it('throws a non-StepError for missing auth data, because callers outside a step use it', () => {
    let error: unknown
    try {
      extractAuthDataWithPlumberFolder(makeGlobalVariable(undefined))
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(z.ZodError)
    expect(error).not.toBeInstanceOf(StepError)
  })
})
