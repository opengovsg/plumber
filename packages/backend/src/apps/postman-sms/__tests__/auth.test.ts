import type { IGlobalVariable } from '@plumber/types'

import type { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import isStillVerified from '../auth/is-still-verified'
import verifyCredentials from '../auth/verify-credentials'
import { PostmanEnv } from '../common/constants'

const mocks = vi.hoisted(() => ({
  authSet: vi.fn(),
  httpGet: vi.fn(),
  getPostmanEnv: vi.fn(() => PostmanEnv.Test),
}))

vi.mock('../common/get-postman-env', () => ({
  default: mocks.getPostmanEnv,
}))

describe('Postman SMS auth', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        data: {},
        set: mocks.authSet,
      },
      http: {
        get: mocks.httpGet,
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verify credentials', () => {
    beforeEach(() => {
      $.auth.data = {
        screenName: 'My Campaign',
        campaignId: 'test-campaign-id',
        apiKey: 'test-api-key',
      }

      mocks.authSet.mockImplementation((obj) => {
        $.auth.data = {
          ...$.auth.data,
          ...obj,
        }
      })
    })

    it('adds a [TEST] prefix to the label if user is adding a test env campaign, unless user added that prefix themselves already', async () => {
      $.auth.data.screenName = 'My Campaign'
      mocks.getPostmanEnv.mockReturnValue(PostmanEnv.Test)

      await verifyCredentials($)
      expect(mocks.authSet).toBeCalledWith(
        expect.objectContaining({
          screenName: '[TEST] My Campaign',
        }),
      )
    })

    it('Does not modify the label for test env campaigns which already have a [TEST] prefix', async () => {
      $.auth.data.screenName = '[TEST] My Campaign'
      mocks.getPostmanEnv.mockReturnValue(PostmanEnv.Test)

      await verifyCredentials($)
      expect(mocks.authSet).not.toBeCalled()
    })

    it('Does not modify the label for campaigns in prod', async () => {
      mocks.getPostmanEnv.mockReturnValue(PostmanEnv.Prod)

      await verifyCredentials($)
      expect(mocks.authSet).not.toBeCalled()
    })
  })

  describe('is still verified', () => {
    beforeEach(() => {
      $.auth.data = {
        env: 'test',
        screenName: 'test-label',
        campaignId: 'campaign_123456',
        apiKey: 'test-api-key',
      }
    })

    it('returns true if HTTP request is made successfully', async () => {
      expect(await isStillVerified($)).toEqual(true)
    })

    it("throws descriptive error message if user did not whitelist Plumber's IPs", async () => {
      mocks.httpGet.mockRejectedValue(
        new HttpError({
          response: {
            status: 400,
            data: {
              error: {
                code: 'invalid_ip_address_used',
              },
            },
          },
        } as AxiosError),
      )

      await expect(isStillVerified($)).rejects.toThrowError(
        "Plumber's IPs are not whitelisted in your campaign",
      )
    })

    it('throws descriptive error message if user provided wrong campaign ID or API key', async () => {
      mocks.httpGet.mockRejectedValue(
        new HttpError({
          response: {
            status: 401,
          },
        } as AxiosError),
      )

      await expect(isStillVerified($)).rejects.toThrowError(
        'Provided API key is not for the provided campaign',
      )
    })

    it.each([
      new Error('non-http error'),
      new HttpError({
        response: {
          status: 500,
        },
      } as AxiosError),
      new HttpError({
        response: {
          status: 400,
          data: {
            error: {
              code: 'some_weird_code',
            },
          },
        },
      } as AxiosError),
      new HttpError({
        response: {
          status: 400,
          data: {
            // Missing error
          },
        },
      } as AxiosError),
    ])(
      'throws the underlying error if request failed due to another reason',
      async (error) => {
        mocks.httpGet.mockRejectedValue(error)
        await expect(isStillVerified($)).rejects.toThrowError(error)
      },
    )
  })
})
