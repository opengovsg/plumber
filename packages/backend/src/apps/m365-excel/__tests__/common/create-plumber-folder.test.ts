import { IGlobalVariable } from '@plumber/types'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as m365Config from '@/config/app-env-vars/m365'
import HttpError from '@/errors/http'

import { createPlumberFolder } from '../../common/create-plumber-folder'

const httpPost = vi.fn()
const httpGet = vi.fn()
const getM365TenantInfo = vi.fn(() => ({
  label: 'test-tenant',
  id: 'test-tenant-id',
  sharePointSiteId: 'test-sharepoint-site-id',
  clientId: 'abcd',
  clientThumbprint: 'abcd',
  clientPrivateKey: 'abcd',
  allowedSensitivityLabelGuids: new Set(),
}))

describe('Create plumber folder', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    vi.spyOn(m365Config, 'getM365TenantInfo').mockImplementation(
      getM365TenantInfo as never,
    )

    $ = {
      http: {
        post: httpPost,
        get: httpGet,
      },
      user: {
        email: 'test@open.gov.sg',
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    httpPost.mockReset()
    httpGet.mockReset()
    getM365TenantInfo.mockReset()
    getM365TenantInfo.mockImplementation(() => ({
      label: 'test-tenant',
      id: 'test-tenant-id',
      sharePointSiteId: 'test-sharepoint-site-id',
      clientId: 'abcd',
      clientThumbprint: 'abcd',
      clientPrivateKey: 'abcd',
      allowedSensitivityLabelGuids: new Set(),
    }))
    vi.restoreAllMocks()
  })

  it('calls the appropriate Graph API endpoints to create a folder and grants user access', async () => {
    httpPost
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
    expect(httpPost).toHaveBeenNthCalledWith(
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
    expect(httpPost).toHaveBeenNthCalledWith(
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
    await expect(createPlumberFolder('local-dev', $)).rejects.toThrow(
      'User email unavailable',
    )
  })

  it('proceeds with permission granting if folder already exists', async () => {
    httpPost
      // First call to error out with "folder already exists"
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: {
              error: {
                code: 'nameAlreadyExists',
                message: '',
              },
            },
          },
        } as unknown as AxiosError),
      )
      // 2nd call to grant access; no return value is needed but we mock to
      // prevent outgoing call.
      .mockImplementationOnce(() => {
        // intentionally empty
        return
      })
    httpGet
      // Mock get folder API to return null ID
      .mockResolvedValueOnce({
        data: {
          value: [{ id: 'existing-folder-id' }],
        },
      })

    await createPlumberFolder('local-dev', $)

    expect(httpPost).toHaveBeenNthCalledWith(
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
          folderId: 'existing-folder-id',
        },
      },
    )
  })

  it('errors out if create folder failed and reason was not due to folder existing', async () => {
    httpPost
      // First call to error out some random error message
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: {
              error: {
                code: 'transientFailure',
              },
            },
          },
        } as unknown as AxiosError),
      )
      // 2nd call to grant access; no return value is needed but we mock to
      // prevent outgoing call.
      .mockImplementationOnce(() => {
        // intentionally empty
        return
      })

    try {
      await createPlumberFolder('local-dev', $)
    } catch (error) {
      if (!(error instanceof HttpError)) {
        expect.unreachable()
      }
      expect(error.response.data.error.code === 'transientFailure')
    }
  })

  it('errors out if folder ID is null after creating folder', async () => {
    httpPost
      // Make create folder API return null
      .mockImplementationOnce(() => ({
        data: { id: null },
      }))

    await expect(createPlumberFolder('local-dev', $)).rejects.toThrow(
      /a problem creating your folder/,
    )
  })

  it("errors out if folder ID is null after trying to grab existing folder's ID", async () => {
    httpPost
      // Mock create folder API to error out with "folder already exists"
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: {
              error: {
                code: 'nameAlreadyExists',
                message: '',
              },
            },
          },
        } as unknown as AxiosError),
      )
    httpGet
      // Mock get folder API to return null ID
      .mockResolvedValueOnce({
        data: {
          value: [{ id: null }],
        },
      })

    await expect(createPlumberFolder('local-dev', $)).rejects.toThrow(
      /a problem creating your folder/,
    )
  })
})
