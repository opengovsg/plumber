import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getLockKey } from '../../common/file-lock'

const mocks = vi.hoisted(() => ({
  getTenant: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/config/app-env-vars/m365', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/app-env-vars/m365')>()),
  getM365TenantInfo: mocks.getTenant,
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: mocks.loggerError, info: vi.fn(), warn: vi.fn() },
}))

const VALID_AUTH_DATA = { tenantKey: 'sg-govt', folderId: 'FOLDER' }

function makeGlobalVariable(
  fileId?: string,
  authData: unknown = VALID_AUTH_DATA,
): IGlobalVariable {
  return {
    step: { parameters: fileId ? { fileId } : {} },
    auth: { data: authData },
  } as unknown as IGlobalVariable
}

describe('m365-excel getLockKey', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getTenant.mockReturnValue({ id: 'TENANT-1' })
  })

  it('derives <tenant>:<fileId> for a file-bound action', async () => {
    expect(await getLockKey(makeGlobalVariable('file-xyz'))).toBe(
      'TENANT-1:file-xyz',
    )
  })

  it('returns null when there is no fileId (nothing to lock)', async () => {
    expect(await getLockKey(makeGlobalVariable())).toBeNull()
  })

  it.each([
    ['missing', null],
    ['malformed', { tenantKey: 'nope', folderId: 'FOLDER' }],
  ])(
    'returns null without logging when the auth data is %s',
    async (_, authData) => {
      expect(
        await getLockKey(makeGlobalVariable('file-xyz', authData)),
      ).toBeNull()
      expect(mocks.loggerError).not.toHaveBeenCalled()
    },
  )

  it('returns null when the tenant lookup fails', async () => {
    mocks.getTenant.mockImplementation(() => {
      throw new Error('no tenant info')
    })
    expect(await getLockKey(makeGlobalVariable('file-xyz'))).toBeNull()
  })
})
