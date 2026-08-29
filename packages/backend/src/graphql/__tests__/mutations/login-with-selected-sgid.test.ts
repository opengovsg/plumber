import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import loginWithSelectedSgid from '@/graphql/mutations/login-with-selected-sgid'
import * as auth from '@/helpers/auth'
import { SGID_MULTI_HAT_COOKIE_NAME } from '@/helpers/sgid'
import type User from '@/models/user'
import { spyOnLogger } from '@/test/spy-on-logger'
import type Context from '@/types/express/context'

const setAuthCookie = vi.fn()
const getOrCreateUser = vi.fn()
const sendOnboardingEmail = vi.fn()
const updateLastLogin = vi.fn()
const verifyJwt = vi.fn()
let logError: ReturnType<typeof vi.fn>

describe('Login with selected SGID', () => {
  let context: Context

  beforeEach(() => {
    const loggerSpies = spyOnLogger({ error: vi.fn() })
    logError = loggerSpies.error

    vi.spyOn(auth, 'setAuthCookie').mockImplementation(setAuthCookie)
    vi.spyOn(auth, 'getOrCreateUser').mockImplementation(getOrCreateUser)
    vi.spyOn(auth, 'sendOnboardingEmail').mockImplementation(
      sendOnboardingEmail,
    )
    vi.spyOn(auth, 'updateLastLogin').mockImplementation(updateLastLogin)
    vi.spyOn(jwt, 'verify').mockImplementation(verifyJwt)

    context = {
      res: {
        clearCookie: vi.fn(),
      },
      req: {
        cookies: {},
      },
    } as unknown as Context
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should log user in if multi-hat user provided a valid work email', async () => {
    verifyJwt.mockReturnValueOnce({
      publicOfficerEmployments: [
        {
          workEmail: 'loong_loong@coffee.gov.sg',
          agencyName: 'Ministry of Coffee',
          departmentName: 'Baristas',
          employmentType: 'Permanent',
          employmentTitle: 'Chief Barista',
        },
        {
          workEmail: 'weeeeeeeee@potato.gov.sg',
          agencyName: 'Ministry of Potato Chips',
          departmentName: 'Flavouring',
          employmentType: 'Permanent',
          employmentTitle: 'Sea Salt Scientist',
        },
      ],
    })
    getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)

    const result = await loginWithSelectedSgid(
      null,
      {
        input: {
          workEmail: 'loong_loong@coffee.gov.sg',
        },
      },
      context,
    )

    expect(getOrCreateUser).toHaveBeenCalledWith('loong_loong@coffee.gov.sg')
    expect(sendOnboardingEmail).toHaveBeenCalledWith({ id: 'abc-def' })
    expect(updateLastLogin).toHaveBeenCalledWith('abc-def')
    expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
      userId: 'abc-def',
    })
    expect(result.success).toEqual(true)
  })

  it('should throw error if multi-hat user provided an invalid work email', async () => {
    verifyJwt.mockReturnValueOnce({
      publicOfficerEmployments: [
        {
          workEmail: 'loong_loong@coffee.gov.sg',
          agencyName: 'Ministry of Coffee',
          departmentName: 'Baristas',
          employmentType: 'Permanent',
          employmentTitle: 'Chief Barista',
        },
        {
          workEmail: 'weeeeeeeee@potato.gov.sg',
          agencyName: 'Ministry of Potato Chips',
          departmentName: 'Flavouring',
          employmentType: 'Permanent',
          employmentTitle: 'Sea Salt Scientist',
        },
      ],
    })

    await expect(
      loginWithSelectedSgid(
        null,
        {
          input: {
            workEmail: 'not_loong@coffee.gov.sg',
          },
        },
        context,
      ),
    ).rejects.toThrow('Invalid work email')

    expect(getOrCreateUser).not.toHaveBeenCalled()
    expect(sendOnboardingEmail).not.toHaveBeenCalled()
    expect(updateLastLogin).not.toHaveBeenCalled()
    expect(setAuthCookie).not.toHaveBeenCalled()
  })

  it('should log error if JWT validation failed', async () => {
    context.req.cookies[SGID_MULTI_HAT_COOKIE_NAME] = 'test cookie data'
    verifyJwt.mockImplementationOnce(() => {
      throw new Error('test')
    })

    await expect(
      loginWithSelectedSgid(
        null,
        {
          input: {
            workEmail: 'not_loong@coffee.gov.sg',
          },
        },
        context,
      ),
    ).rejects.toThrow('test')

    expect(logError).toHaveBeenCalledWith(
      'Could not validate sgid multi-hat cookie',
      {
        event: 'sgid-login-failed-cookie-validation',
        cookieData: 'test cookie data',
      },
    )
  })
})
