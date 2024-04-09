import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPlumberFolder } from '../../common/create-plumber-folder'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
  getM365TenantInfo: vi.fn(() => ({
    label: 'test-tenant',
    id: 'test-tenant-id',
    sharePointSiteId: 'test-sharepoint-site-id',
    clientId: 'abcd',
    clientThumbprint: 'abcd',
    clientPrivateKey: 'abcd',
    allowedSensitivityLabelGuids: new Set(),
  })),
}))

vi.mock('@/config/app-env-vars/m365', () => ({
  getM365TenantInfo: mocks.getM365TenantInfo,
}))

describe('Create plumber folder', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      http: {
        post: mocks.httpPost,
      },
      user: {
        email: 'test@open.gov.sg',
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the appropriate Graph API endpoints to create a folder and grants user access', async () => {
    mocks.httpPost
      // First call to create folder
      .mockImplementationOnce(() => ({
        data: { id: 'test-folder-id' },
      }))
      // 2nd call to grant access; no return value is needed but we mock to
      // prevent outgoing call.
      .mockImplementationOnce(() => {
        // intentionally empty
        return
      })

    await createPlumberFolder('local-dev', $)
    expect(mocks.httpPost).toHaveBeenNthCalledWith(
      1,
      '/v1.0/sites/:sharePointSiteId/drive/root/children',
      {
        name: 'test@open.gov.sg',
        folder: {},
      },
      {
        urlPathParams: {
          sharePointSiteId: 'test-sharepoint-site-id',
        },
      },
    )
    expect(mocks.httpPost).toHaveBeenNthCalledWith(
      2,
      '/v1.0/sites/:sharePointSiteId/drive/items/:folderId/invite',
      {
        recipients: [{ email: 'test@open.gov.sg' }],
        requireSignIn: true,
        sendInvitation: false,
        roles: ['sp.full control'],
        retainInheritedPermissions: false,
      },
      {
        urlPathParams: {
          sharePointSiteId: 'test-sharepoint-site-id',
          folderId: 'test-folder-id',
        },
      },
    )
  })

  it("errors out if user's email is not set", async () => {
    $.user.email = null
    expect(createPlumberFolder('local-dev', $)).rejects.toThrowError(
      'User email unavailable',
    )
  })
})
