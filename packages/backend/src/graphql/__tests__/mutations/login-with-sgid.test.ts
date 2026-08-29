import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import loginWithSgid from '@/graphql/mutations/login-with-sgid'
import * as auth from '@/helpers/auth'
import { sgidClient } from '@/helpers/sgid'
import LoginWhitelistEntry from '@/models/login-whitelist-entry'
import type User from '@/models/user'
import { spyOnLogger } from '@/test/spy-on-logger'
import type Context from '@/types/express/context'

const sgidCallback = vi.fn(() => ({ accessToken: '123', sub: 'abc' }))
const sgidUserInfo = vi.fn()
const setAuthCookie = vi.fn()
const getOrCreateUser = vi.fn()
const sendOnboardingEmail = vi.fn()
const updateLastLogin = vi.fn()
const isWhitelistedEmail = vi.fn()
const signJwt = vi.fn(() => 'stub')
let logError: ReturnType<typeof vi.fn>

const STUB_PARAMS = {
  input: {
    authCode: 'abcde',
    nonce: '12345',
    verifier: 'wxyz',
  },
}

const STUB_CONTEXT = {
  res: {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  },
  req: {},
} as unknown as Context

describe('Login with SGID', () => {
  beforeEach(() => {
    const loggerSpies = spyOnLogger({ error: vi.fn() })
    logError = loggerSpies.error

    vi.spyOn(sgidClient, 'callback').mockImplementation(sgidCallback)
    vi.spyOn(sgidClient, 'userinfo').mockImplementation(sgidUserInfo)
    vi.spyOn(auth, 'setAuthCookie').mockImplementation(setAuthCookie)
    vi.spyOn(auth, 'getOrCreateUser').mockImplementation(getOrCreateUser)
    vi.spyOn(auth, 'sendOnboardingEmail').mockImplementation(sendOnboardingEmail)
    vi.spyOn(auth, 'updateLastLogin').mockImplementation(updateLastLogin)
    vi.spyOn(LoginWhitelistEntry, 'isWhitelisted').mockImplementation(
      isWhitelistedEmail,
    )
    vi.spyOn(jwt, 'sign').mockImplementation(signJwt)
  })

  afterEach(() => {
    vi.clearAllMocks()
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
    sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': JSON.stringify(pocdexData),
      },
    })
    getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(getOrCreateUser).toHaveBeenCalledWith('loong_loong@coffee.gov.sg')
    expect(sendOnboardingEmail).toHaveBeenCalledWith({ id: 'abc-def' })
    expect(updateLastLogin).toHaveBeenCalledWith('abc-def')
    expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
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
      sgidUserInfo.mockResolvedValueOnce({ data })

      const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

      expect(getOrCreateUser).not.toHaveBeenCalled()
      expect(setAuthCookie).not.toHaveBeenCalled()
      expect(result.publicOfficerEmployments).toEqual([])
    },
  )

  it('should exclude pocdex entries with missing / NA work emails (failed due to no other emails scenario)', async () => {
    sgidUserInfo.mockResolvedValueOnce({
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

    expect(getOrCreateUser).not.toHaveBeenCalled()
    expect(sendOnboardingEmail).not.toHaveBeenCalled()
    expect(updateLastLogin).not.toHaveBeenCalled()
    expect(setAuthCookie).not.toHaveBeenCalled()
    expect(result.publicOfficerEmployments).toEqual([])
  })

  it('should exclude pocdex entries with missing / NA work emails (direct login due to one other email scenario)', async () => {
    sgidUserInfo.mockResolvedValueOnce({
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
    getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)

    const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

    expect(getOrCreateUser).toHaveBeenCalledWith('loong@tea.gov.sg')
    expect(sendOnboardingEmail).toHaveBeenCalledWith({ id: 'abc-def' })
    expect(updateLastLogin).toHaveBeenCalledWith('abc-def')
    expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
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
      isWhitelistedEmail.mockResolvedValueOnce(isWhitelisted)
      sgidUserInfo.mockResolvedValueOnce({
        data: {
          'pocdex.public_officer_details': JSON.stringify(pocdexData),
        },
      })
      getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)
      const result = await loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT)

      if (isWhitelisted) {
        expect(getOrCreateUser).toHaveBeenCalledWith(
          'loong_loong@gahmen-coffee.com.sg',
        )
        expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
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
        expect(getOrCreateUser).not.toHaveBeenCalled()
        expect(setAuthCookie).not.toHaveBeenCalled()
        expect(result.publicOfficerEmployments).toEqual([])
      }
    },
  )

  it('should log error when POCDEX parsing fails', async () => {
    sgidUserInfo.mockResolvedValueOnce({
      data: {
        'pocdex.public_officer_details': '[Invalid JSON string',
      },
    })

    await expect(
      loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT),
    ).rejects.toThrow('Received malformed data from POCDEX')

    expect(logError).toHaveBeenCalledWith(
      'Received malformed data from POCDEX',
      {
        event: 'sgid-login-malformed-pocdex',
        pocdexString: '[Invalid JSON string',
      },
    )
    expect(getOrCreateUser).not.toHaveBeenCalled()
    expect(sendOnboardingEmail).not.toHaveBeenCalled()
    expect(updateLastLogin).not.toHaveBeenCalled()
    expect(setAuthCookie).not.toHaveBeenCalled()
  })

  it('should log error when user info querying process fails', async () => {
    sgidCallback.mockImplementationOnce(() => {
      throw new Error('derp')
    })

    await expect(
      loginWithSgid(null, STUB_PARAMS, STUB_CONTEXT),
    ).rejects.toThrow('derp')

    expect(logError).toHaveBeenCalledWith('Unable to query user info', {
      event: 'sgid-login-failed-user-info',
    })
    expect(getOrCreateUser).not.toHaveBeenCalled()
    expect(sendOnboardingEmail).not.toHaveBeenCalled()
    expect(updateLastLogin).not.toHaveBeenCalled()
    expect(setAuthCookie).not.toHaveBeenCalled()
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
    sgidUserInfo.mockResolvedValueOnce({
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
    expect(signJwt).toHaveBeenCalledWith(
      {
        publicOfficerEmployments: expectedEntries,
      },
      expect.anything(),
    )
    expect(STUB_CONTEXT.res.cookie).toHaveBeenCalled()

    expect(setAuthCookie).not.toHaveBeenCalled()
  })

  it("should convert non-email 'NA' values to null before returning POCDEX entries", async () => {
    sgidUserInfo.mockResolvedValueOnce({
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
