import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import loginWithSelectedSgid from '@/graphql/mutations/login-with-selected-sgid'
import { SGID_MULTI_HAT_COOKIE_NAME } from '@/helpers/sgid'
import type User from '@/models/user'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  setAuthCookie: vi.fn(),
  getOrCreateUser: vi.fn(),
  logError: vi.fn(),
  verifyJwt: vi.fn(),
}))

vi.mock('@/helpers/auth', () => ({
  setAuthCookie: mocks.setAuthCookie,
  getOrCreateUser: mocks.getOrCreateUser,
}))

vi.mock('jsonwebtoken', () => ({
  verify: mocks.verifyJwt,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
  },
}))

describe('Login with selected SGID', () => {
  let context: Context

  beforeEach(() => {
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
    vi.restoreAllMocks()
  })

  it('should log user in if multi-hat user provided a valid work email', async () => {
    mocks.verifyJwt.mockReturnValueOnce({
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
    mocks.getOrCreateUser.mockResolvedValueOnce({ id: 'abc-def' } as User)

    const result = await loginWithSelectedSgid(
      {
        input: {
          workEmail: 'loong_loong@coffee.gov.sg',
        },
      },
      context,
    )

    expect(mocks.getOrCreateUser).toHaveBeenCalledWith(
      'loong_loong@coffee.gov.sg',
    )
    expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
      userId: 'abc-def',
    })
    expect(result.success).toEqual(true)
  })

  it('should throw error if multi-hat user provided an invalid work email', async () => {
    mocks.verifyJwt.mockReturnValueOnce({
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
        {
          input: {
            workEmail: 'not_loong@coffee.gov.sg',
          },
        },
        context,
      ),
    ).rejects.toThrowError('Invalid work email')

    expect(mocks.getOrCreateUser).not.toBeCalled()
    expect(mocks.setAuthCookie).not.toBeCalled()
  })

  it('should log error if JWT validation failed', async () => {
    context.req.cookies[SGID_MULTI_HAT_COOKIE_NAME] = 'test cookie data'
    mocks.verifyJwt.mockImplementationOnce(() => {
      throw new Error('test')
    })

    await expect(
      loginWithSelectedSgid(
        {
          input: {
            workEmail: 'not_loong@coffee.gov.sg',
          },
        },
        context,
      ),
    ).rejects.toThrowError('test')

    expect(mocks.logError).toBeCalledWith(
      'Could not validate sgid multi-hat cookie',
      {
        event: 'sgid-login-failed-cookie-validation',
        cookieData: 'test cookie data',
      },
    )
  })
})
