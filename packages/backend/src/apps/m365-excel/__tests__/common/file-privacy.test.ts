import type { IHttpClient } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeHttpError } from '@/../test/utils/make-http-error'
import StepError from '@/errors/step'

import {
  getWriteAccessEmailCandidates,
  validateCanAccessFile,
} from '../../common/file-privacy'

vi.mock('@/config/app-env-vars/m365', () => ({
  getM365TenantInfo: () => ({
    sharePointSiteId: 'SITE',
    allowedSensitivityLabelGuids: new Set(['ALLOWED-LABEL']),
  }),
}))

describe('getWriteAccessEmailCandidates', () => {
  it('adds the SWDA alias for legacy domains', () => {
    expect(getWriteAccessEmailCandidates('test@wsg.gov.sg')).toEqual([
      'test@wsg.gov.sg',
      'test@swda.gov.sg',
    ])
    expect(getWriteAccessEmailCandidates('test@ssg.gov.sg')).toEqual([
      'test@ssg.gov.sg',
      'test@swda.gov.sg',
    ])
    expect(getWriteAccessEmailCandidates('test@ssg-wsg.gov.sg')).toEqual([
      'test@ssg-wsg.gov.sg',
      'test@swda.gov.sg',
    ])
  })

  it('returns only the original email for other domains', () => {
    expect(getWriteAccessEmailCandidates('test@open.gov.sg')).toEqual([
      'test@open.gov.sg',
    ])
    expect(getWriteAccessEmailCandidates('test@swda.gov.sg')).toEqual([
      'test@swda.gov.sg',
    ])
  })
})

describe('validateCanAccessFile', () => {
  const authData = { tenantKey: 'tenant', folderId: 'FOLDER' }
  const get = vi.fn()
  const http = { get } as unknown as IHttpClient

  function mockFileInfo(overrides: {
    labelId?: string | null
    folderId?: string
    writerEmail?: string
  }) {
    get.mockResolvedValue({
      data: {
        sensitivityLabel: {
          id:
            overrides.labelId === undefined
              ? 'allowed-label'
              : overrides.labelId,
        },
        parentReference: {
          driveType: 'documentLibrary',
          id: overrides.folderId ?? 'folder',
          siteId: 'site',
        },
        permissions: [
          {
            roles: ['write'],
            grantedToV2: {
              user: { email: overrides.writerEmail ?? 'owner@open.gov.sg' },
            },
          },
        ],
      },
    })
  }

  async function catchStepError(): Promise<StepError> {
    const error = await validateCanAccessFile(
      'owner@open.gov.sg',
      authData,
      'file-id',
      http,
    ).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(StepError)
    return error as StepError
  }

  beforeEach(() => {
    get.mockReset()
  })

  it('allows a labelled file in the Plumber folder that the user can write to', async () => {
    mockFileInfo({})
    await expect(
      validateCanAccessFile('owner@open.gov.sg', authData, 'file-id', http),
    ).resolves.toBeUndefined()
  })

  it.each([
    [
      'the file is outside the Plumber folder',
      { folderId: 'other-folder' },
      'File must be in your Plumber folder',
    ],
    [
      'the user lacks write access',
      { writerEmail: 'someone-else@open.gov.sg' },
      'You need write access to use this file in your pipe.',
    ],
    [
      'the file has no sensitivity label',
      { labelId: null },
      'Your file needs a sensitivity label.',
    ],
    [
      'the sensitivity label is not allowed',
      { labelId: 'secret-label' },
      'File sensitivity should be up to Restricted and Sensitive-Normal.',
    ],
  ])('throws a config StepError when %s', async (_case, overrides, name) => {
    mockFileInfo(overrides)
    const error = await catchStepError()
    expect(error.kind).toBe('config')
    expect(JSON.parse(error.message).name).toBe(name)
  })

  it('converts a Graph HttpError from the file query', async () => {
    const httpError = makeHttpError({
      status: 404,
      data: { error: { code: 'itemNotFound' } },
    })
    get.mockRejectedValue(httpError)
    const error = await catchStepError()
    expect(error.kind).toBe('config')
    expect(error.cause).toBe(httpError)
  })
})
