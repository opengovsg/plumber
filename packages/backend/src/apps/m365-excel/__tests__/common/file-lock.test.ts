import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getLockKey } from '../../common/file-lock'

const mocks = vi.hoisted(() => ({
  extractAuthData: vi.fn(),
  getTenant: vi.fn(),
}))

vi.mock('@/apps/m365-excel/common/auth-data', () => ({
  extractAuthDataWithPlumberFolder: mocks.extractAuthData,
}))

vi.mock('@/config/app-env-vars/m365', () => ({
  getM365TenantInfo: mocks.getTenant,
}))

function makeGlobalVariable(fileId?: string): IGlobalVariable {
  return {
    step: { parameters: fileId ? { fileId } : {} },
    auth: { data: { tenantKey: 'sg-govt', folderId: 'FOLDER' } },
  } as unknown as IGlobalVariable
}

describe('m365-excel getLockKey', () => {
  beforeEach(() => {
    mocks.extractAuthData.mockReturnValue({
      tenantKey: 'sg-govt',
      folderId: 'FOLDER',
    })
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

  it('returns null when the tenant cannot be derived (e.g. bad auth)', async () => {
    mocks.extractAuthData.mockImplementation(() => {
      throw new Error('bad auth data')
    })
    expect(await getLockKey(makeGlobalVariable('file-xyz'))).toBeNull()
  })
})
