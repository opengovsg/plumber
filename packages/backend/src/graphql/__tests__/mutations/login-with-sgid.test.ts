import { afterEach, describe, expect, it, vi } from 'vitest'

import appConfig from '@/config/app'
import loginWithSgid from '@/graphql/mutations/login-with-sgid'
import type User from '@/models/user'
import type Context from '@/types/express/context'

const STUB_PARAMS = {
  input: {
    authCode: 'abcde',
    nonce: '12345',
    verifier: 'wxyz',
  },
}

const STUB_CONTEXT = {
  res: {},
  req: {},
} as Context

const mocks = vi.hoisted(() => ({
  sgidCallback: vi.fn(() => ({ accessToken: '123', sub: 'abc' })),
  sgidUserInfo: vi.fn(),
  setAuthCookie: vi.fn(),
  getOrCreateUser: vi.fn(),
  isWhitelistedEmail: vi.fn(),
}))

vi.mock('@opengovsg/sgid-client', () => ({
  SgidClient: function () {
    return {
      callback: mocks.sgidCallback,
      userinfo: mocks.sgidUserInfo,
    }
  },
}))

vi.mock('@/helpers/auth', () => ({
  setAuthCookie: mocks.setAuthCookie,
  getOrCreateUser: mocks.getOrCreateUser,
}))

vi.mock('@/models/login-whitelist-entry', () => ({
  default: {
    isWhitelisted: mocks.isWhitelistedEmail,
  },
}))

describe('Login with SGID', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should log users in directly if they only have 1 pocdex entry', async () => {
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_employments': JSON.stringify([
          {
            workEmail: 'loong_loong@coffee.gov.sg',
            agencyName: 'Ministry of Coffee',
            departmentName: 'Baristas',
            employmentType: 'Permanent',
            employmentTitle: 'Chief Barista',
          },
        ]),
      },
    })
    mocks.getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(mocks.getOrCreateUser).toHaveBeenCalledWith(
      'loong_loong@coffee.gov.sg',
    )
    expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
      userId: 'abc-def',
    })
    expect(result.nextUrl).toEqual(`${appConfig.webAppUrl}/flows`)
  })

  it.each([
    // No pocdex data at all
    {},
    // Empty array from pocdex
    { 'pocdex.public_officer_employments': '[]' },
  ])(
    'should redirect to failure url if there is nothing from pocdex',
    async (data) => {
      mocks.sgidUserInfo.mockResolvedValueOnce({ data })

      const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

      expect(mocks.getOrCreateUser).not.toBeCalled()
      expect(mocks.setAuthCookie).not.toBeCalled()
      expect(result.nextUrl).toEqual(
        `${appConfig.webAppUrl}/login/?not_sgid_eligible=1`,
      )
    },
  )

  it('should exclude pocdex entries with missing / NA work emails (failed due to no other emails scenario)', async () => {
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_employments': JSON.stringify([
          {
            workEmail: 'NA',
            agencyName: 'Ministry of Coffee',
            departmentName: 'Baristas',
            employmentType: 'Permanent',
            employmentTitle: 'Chief Barista',
          },
        ]),
      },
    })

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(mocks.getOrCreateUser).not.toBeCalled()
    expect(mocks.setAuthCookie).not.toBeCalled()
    expect(result.nextUrl).toEqual(
      `${appConfig.webAppUrl}/login/?not_sgid_eligible=1`,
    )
  })

  it('should exclude pocdex entries with missing / NA work emails (direct login due to one other email scenario)', async () => {
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_employments': JSON.stringify([
          {
            workEmail: 'NA',
            agencyName: 'Ministry of Coffee',
            departmentName: 'Baristas',
            employmentType: 'Permanent',
            employmentTitle: 'Chief Barista',
          },
          {
            workEmail: 'NA',
            agencyName: 'Ministry of Macarons',
            departmentName: 'Tasting',
            employmentType: 'Permanent',
            employmentTitle: 'Chief Taste Tester',
          },
          {
            workEmail: 'loong@tea.gov.sg',
            agencyName: 'Ministry of Tea',
            departmentName: 'Drinkers',
            employmentType: 'Permanent',
            employmentTitle: 'Tea Chugger Extraordinaire',
          },
        ]),
      },
    })
    mocks.getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(mocks.getOrCreateUser).toHaveBeenCalledWith('loong@tea.gov.sg')
    expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
      userId: 'abc-def',
    })
    expect(result.nextUrl).toEqual(`${appConfig.webAppUrl}/flows`)
  })

  it.each([{ isWhitelisted: true }, { isWhitelisted: false }])(
    'should account for whitelisting of non-gov emails (isWhitelisted: $isWhitelisted)',
    async ({ isWhitelisted }) => {
      mocks.isWhitelistedEmail.mockResolvedValueOnce(isWhitelisted)
      mocks.sgidUserInfo.mockResolvedValueOnce({
        data: {
          'pocdex.public_officer_employments': JSON.stringify([
            {
              workEmail: 'loong_loong@gahmen-coffee.com.sg',
              agencyName: 'Coffee Research Institute',
              departmentName: 'Beanology',
              employmentType: 'Permanent',
              employmentTitle: 'Bean Scientist',
            },
          ]),
        },
      })
      mocks.getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)
      const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

      if (isWhitelisted) {
        expect(mocks.getOrCreateUser).toHaveBeenCalledWith(
          'loong_loong@gahmen-coffee.com.sg',
        )
        expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
          userId: 'abc-def',
        })
        expect(result.nextUrl).toEqual(`${appConfig.webAppUrl}/flows`)
      } else {
        expect(mocks.getOrCreateUser).not.toBeCalled()
        expect(mocks.setAuthCookie).not.toBeCalled()
        expect(result.nextUrl).toEqual(
          `${appConfig.webAppUrl}/login/?not_sgid_eligible=1`,
        )
      }
    },
  )
})
