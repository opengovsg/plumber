import { afterEach, describe, expect, it, vi } from 'vitest'

import loginWithSgid from '@/graphql/mutations/login-with-sgid'
import type User from '@/models/user'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  sgidCallback: vi.fn(() => ({ accessToken: '123', sub: 'abc' })),
  sgidUserInfo: vi.fn(),
  setAuthCookie: vi.fn(),
  getOrCreateUser: vi.fn(),
  isWhitelistedEmail: vi.fn(),
  logError: vi.fn(),
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
  signJwt: vi.fn(() => 'stub'),
}))

const STUB_PARAMS = {
  input: {
    authCode: 'abcde',
    nonce: '12345',
    verifier: 'wxyz',
  },
}

const STUB_CONTEXT = {
  res: {
    cookie: mocks.setCookie,
    clearCookie: mocks.clearCookie,
  },
  req: {},
} as unknown as Context

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

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
  },
}))

vi.mock('jsonwebtoken', () => ({
  sign: mocks.signJwt,
}))

describe('Login with SGID', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should log users in directly if they only have 1 pocdex entry', async () => {
    const pocdexData = [
      {
        work_email: 'loong_loong@coffee.gov.sg',
        agency_name: 'Ministry of Coffee',
        department_name: 'Baristas',
        employment_type: 'Permanent',
        employment_title: 'Chief Barista',
      },
    ]
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': JSON.stringify(pocdexData),
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
    expect(result.publicOfficerEmployments).toEqual([
      {
        workEmail: 'loong_loong@coffee.gov.sg',
        agencyName: 'Ministry of Coffee',
        departmentName: 'Baristas',
        employmentType: 'Permanent',
        employmentTitle: 'Chief Barista',
      },
    ])
  })

  it.each([
    // No pocdex data at all
    {},
    // Empty array from pocdex
    { 'pocdex.public_officer_details': '[]' },
  ])(
    'should return an empty array if there is nothing from pocdex',
    async (data) => {
      mocks.sgidUserInfo.mockResolvedValueOnce({ data })

      const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

      expect(mocks.getOrCreateUser).not.toBeCalled()
      expect(mocks.setAuthCookie).not.toBeCalled()
      expect(result.publicOfficerEmployments).toEqual([])
    },
  )

  it('should exclude pocdex entries with missing / NA work emails (failed due to no other emails scenario)', async () => {
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': JSON.stringify([
          {
            work_email: 'NA',
            agency_name: 'Ministry of Coffee',
            department_name: 'Baristas',
            employment_type: 'Permanent',
            employment_title: 'Chief Barista',
          },
        ]),
      },
    })

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(mocks.getOrCreateUser).not.toBeCalled()
    expect(mocks.setAuthCookie).not.toBeCalled()
    expect(result.publicOfficerEmployments).toEqual([])
  })

  it('should exclude pocdex entries with missing / NA work emails (direct login due to one other email scenario)', async () => {
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': JSON.stringify([
          {
            work_email: 'NA',
            agency_name: 'Ministry of Coffee',
            department_name: 'Baristas',
            employment_type: 'Permanent',
            employment_title: 'Chief Barista',
          },
          {
            work_email: 'NA',
            agency_name: 'Ministry of Macarons',
            department_name: 'Tasting',
            employment_type: 'Permanent',
            employment_title: 'Chief Taste Tester',
          },
          {
            work_email: 'loong@tea.gov.sg',
            agency_name: 'Ministry of Tea',
            department_name: 'Drinkers',
            employment_type: 'Permanent',
            employment_title: 'Tea Chugger Extraordinaire',
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
    expect(result.publicOfficerEmployments).toEqual([
      {
        workEmail: 'loong@tea.gov.sg',
        agencyName: 'Ministry of Tea',
        departmentName: 'Drinkers',
        employmentType: 'Permanent',
        employmentTitle: 'Tea Chugger Extraordinaire',
      },
    ])
  })

  it.each([{ isWhitelisted: true }, { isWhitelisted: false }])(
    'should account for whitelisting of non-gov emails (isWhitelisted: $isWhitelisted)',
    async ({ isWhitelisted }) => {
      const pocdexData = [
        {
          work_email: 'loong_loong@gahmen-coffee.com.sg',
          agency_name: 'Coffee Research Institute',
          department_name: 'Beanology',
          employment_type: 'Permanent',
          employment_title: 'Bean Scientist',
        },
      ]
      mocks.isWhitelistedEmail.mockResolvedValueOnce(isWhitelisted)
      mocks.sgidUserInfo.mockResolvedValueOnce({
        data: {
          'pocdex.public_officer_details': JSON.stringify(pocdexData),
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
        expect(result.publicOfficerEmployments).toEqual([
          {
            workEmail: 'loong_loong@gahmen-coffee.com.sg',
            agencyName: 'Coffee Research Institute',
            departmentName: 'Beanology',
            employmentType: 'Permanent',
            employmentTitle: 'Bean Scientist',
          },
        ])
      } else {
        expect(mocks.getOrCreateUser).not.toBeCalled()
        expect(mocks.setAuthCookie).not.toBeCalled()
        expect(result.publicOfficerEmployments).toEqual([])
      }
    },
  )

  it('should log error when POCDEX parsing fails', async () => {
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': '[Invalid JSON string',
      },
    })

    await expect(
      loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT),
    ).rejects.toThrowError('Received malformed data from POCDEX')

    expect(mocks.logError).toBeCalledWith(
      'Received malformed data from POCDEX',
      {
        event: 'sgid-login-malformed-pocdex',
        pocdexString: '[Invalid JSON string',
      },
    )
    expect(mocks.getOrCreateUser).not.toBeCalled()
    expect(mocks.setAuthCookie).not.toBeCalled()
  })

  it('should log error when user info querying process fails', async () => {
    mocks.sgidCallback.mockImplementationOnce(() => {
      throw new Error('derp')
    })

    await expect(
      loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT),
    ).rejects.toThrowError('derp')

    expect(mocks.logError).toBeCalledWith('Unable to query user info', {
      event: 'sgid-login-failed-user-info',
    })
    expect(mocks.getOrCreateUser).not.toBeCalled()
    expect(mocks.setAuthCookie).not.toBeCalled()
  })

  it('should only cookie-fy and return filtered entries if user has multiple POCDEX entries', async () => {
    const pocdexData = [
      // Should be included.
      {
        work_email: 'loong_loong@potato.gov.sg',
        agency_name: 'Ministry of Potato Chips',
        department_name: 'Flavouring',
        employment_type: 'Permanent',
        employment_title: 'Sea Salt Scientist',
      },
      {
        work_email: 'loong@tea.gov.sg',
        agency_name: 'Ministry of Tea',
        department_name: 'Drinkers',
        employment_type: 'Permanent',
        employment_title: 'Tea Chugger Extraordinaire',
      },

      // Should be filtered out
      {
        work_email: 'NA',
        agency_name: 'Ministry of Macarons',
        department_name: 'Tasting',
        employment_type: 'Permanent',
        employment_title: 'Chief Taste Tester',
      },
      {
        work_email: 'wee@non-whitelisted-glc.com.sg',
        agency_name: 'Non-whitelisted GLC',
        department_name: 'Herp',
        employment_type: 'Permanent',
        employment_title: 'Derp',
      },
    ]
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': JSON.stringify(pocdexData),
      },
    })
    const expectedEntries = [
      {
        workEmail: 'loong_loong@potato.gov.sg',
        agencyName: 'Ministry of Potato Chips',
        departmentName: 'Flavouring',
        employmentType: 'Permanent',
        employmentTitle: 'Sea Salt Scientist',
      },
      {
        workEmail: 'loong@tea.gov.sg',
        agencyName: 'Ministry of Tea',
        departmentName: 'Drinkers',
        employmentType: 'Permanent',
        employmentTitle: 'Tea Chugger Extraordinaire',
      },
    ]

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(result.publicOfficerEmployments).toEqual(expectedEntries)
    expect(mocks.signJwt).toBeCalledWith(
      {
        publicOfficerEmployments: expectedEntries,
      },
      expect.anything(),
    )
    expect(mocks.setCookie).toBeCalled()

    expect(mocks.setAuthCookie).not.toBeCalled()
  })

  it("should convert non-email 'NA' values to null before returning POCDEX entries", async () => {
    mocks.sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': JSON.stringify([
          {
            work_email: 'loong_loong@potato.gov.sg',
            agency_name: 'NA',
            department_name: 'NA',
            employment_type: 'NA',
            employment_title: 'NA',
          },
          {
            work_email: 'loong@tea.gov.sg',
            agency_name: 'Ministry of Tea',
            department_name: 'NA',
            employment_type: 'NA',
            employment_title: 'Tea Chugger Extraordinaire',
          },
        ]),
      },
    })

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(result.publicOfficerEmployments).toEqual([
      {
        workEmail: 'loong_loong@potato.gov.sg',
        agencyName: null,
        departmentName: null,
        employmentType: null,
        employmentTitle: null,
      },
      {
        workEmail: 'loong@tea.gov.sg',
        agencyName: 'Ministry of Tea',
        departmentName: null,
        employmentType: null,
        employmentTitle: 'Tea Chugger Extraordinaire',
      },
    ])
  })
})
