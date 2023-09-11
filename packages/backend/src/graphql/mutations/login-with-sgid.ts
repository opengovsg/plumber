import { type UserInfoReturn as SgidUserInfoReturn } from '@opengovsg/sgid-client'
import { type Response } from 'express'
import { sign as signJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import logger from '@/helpers/logger'
import {
  type PublicOfficerEmployment,
  SGID_COOKIE_NAME,
  SGID_COOKIE_TTL_SECONDS,
  sgidClient,
} from '@/helpers/sgid'
import type Context from '@/types/express/context'

function setSignedCookie<T extends object>(res: Response, data: T): void {
  const token = signJwt(data, appConfig.sgid.jwtKey)
  res.cookie(SGID_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: !appConfig.isDev,
    maxAge: SGID_COOKIE_TTL_SECONDS * 1000,
  })
}

async function parsePocdexEmployments(
  rawData: string,
): Promise<PublicOfficerEmployment[]> {
  let allEmployments: PublicOfficerEmployment[] = []

  try {
    allEmployments = JSON.parse(rawData) as PublicOfficerEmployment[]
  } catch {
    logger.error('Received malformed data from POCDEX', {
      event: 'sgid-login-malformed-pocdex',
      rawData,
    })
    throw new Error('Received malformed data from POCDEX')
  }

  // POCDEX returns 'NA' instead of null, let's fix that.
  allEmployments = allEmployments.map((employment) => {
    for (const [k, v] of Object.entries(employment)) {
      if (v === 'NA') {
        employment[k as keyof PublicOfficerEmployment] = null
      }
    }
    return employment
  })

  const validEmployments = await Promise.all(
    allEmployments.map(
      async (employment) =>
        employment.workEmail &&
        (await validateAndParseEmail(employment.workEmail)),
    ),
  )

  return allEmployments.filter((_, index) => validEmployments[index])
}

export interface SgidLoginResult {
  /**
   * Success or failure can be determined by the length of this array.
   * - Length = 0: Login failed, we could not find any valid POCDEX data.
   * - Length = 1: Login success, we will return the POCDEX entry used to login.
   * - Length > 1: Multi-hat user; we need the user to select which work email
   *               to login.
   */
  publicOfficerEmployments: PublicOfficerEmployment[]
}

interface LoginWithSgidParams {
  input: { authCode: string; nonce: string; verifier: string }
}

export default async function loginWithSgid(
  _parent: unknown,
  params: LoginWithSgidParams,
  context: Context,
): Promise<SgidLoginResult> {
  const { authCode, nonce, verifier } = params.input

  let userInfo: SgidUserInfoReturn | null = null
  try {
    const { accessToken, sub } = await sgidClient.callback({
      code: authCode,
      nonce,
      codeVerifier: verifier,
    })
    userInfo = await sgidClient.userinfo({ accessToken, sub })

    if (!userInfo) {
      throw new Error('Received nullish user info')
    }
  } catch (error) {
    // Small log event to make it easier to get pulse on sgid error rate.
    logger.error('Unable to query user info', {
      event: 'sgid-login-failed-user-info',
    })

    throw error
  }

  const publicOfficerEmployments = await parsePocdexEmployments(
    userInfo.data?.['pocdex.public_officer_employments'] ?? '[]',
  )

  //
  // Start trying to log user in...
  //

  // Back to OTP if we couldn't find anything on POCDEX...
  if (publicOfficerEmployments.length === 0) {
    return {
      publicOfficerEmployments,
    }
  }

  // Log user in directly if there is only 1 employment.
  if (publicOfficerEmployments.length === 1) {
    const user = await getOrCreateUser(publicOfficerEmployments[0].workEmail)
    setAuthCookie(context.res, { userId: user.id })

    return {
      publicOfficerEmployments,
    }
  }

  // Remaining are all multi-hat users.
  setSignedCookie(context.res, { publicOfficerEmployments })
  return {
    publicOfficerEmployments,
  }
}
