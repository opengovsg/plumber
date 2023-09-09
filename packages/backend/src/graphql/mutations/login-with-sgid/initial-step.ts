import { type Response } from 'express'
import { sign as signJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import type Context from '@/types/express/context'

import {
  type InitialStepParams,
  type LoginWithSgidResult,
  type PublicOfficerEmployment,
  SGID_COOKIE_NAME,
  SGID_COOKIE_TTL_SECONDS,
  sgidClient,
} from './common'

async function parsePocdexEmployments(
  rawData: string,
): Promise<PublicOfficerEmployment[]> {
  const allEmployments = (JSON.parse(rawData) as PublicOfficerEmployment[])
    // POCDEX returns 'NA' instead of null, let's fix that.
    .map((employment) => {
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

function setSignedCookie<T extends object>(res: Response, data: T): void {
  const token = signJwt(data, appConfig.sgid.jwtKey)
  res.cookie(SGID_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: !appConfig.isDev,
    maxAge: SGID_COOKIE_TTL_SECONDS * 1000,
  })
}

export async function processInitialStep(
  params: InitialStepParams,
  context: Context,
): Promise<LoginWithSgidResult> {
  const { authCode, nonce, verifier } = params

  const { accessToken, sub } = await sgidClient.callback({
    code: authCode,
    nonce,
    codeVerifier: verifier,
  })
  const userInfo = await sgidClient.userinfo({ accessToken, sub })

  if (!userInfo) {
    throw new Error('Unable to obtain user info')
  }

  const publicOfficerEmployments = await parsePocdexEmployments(
    userInfo.data?.['pocdex.public_officer_employments'] ?? '[]',
  )

  //
  // Start trying to log user in...
  //
  // FIXME (ogp-weeloong): figure out a better way to share routes between front
  // end and back end
  //

  // Back to OTP if we couldn't find anything on POCDEX...
  if (publicOfficerEmployments.length === 0) {
    return {
      nextUrl: `${appConfig.webAppUrl}/login/?not_sgid_eligible=1`,
    }
  }

  // Log user in directly if there is only 1 employment.
  if (publicOfficerEmployments.length === 1) {
    const user = await getOrCreateUser(publicOfficerEmployments[0].workEmail)
    setAuthCookie(context.res, { userId: user.id })

    return {
      nextUrl: `${appConfig.webAppUrl}/flows`,
    }
  }

  // Remaining are all multi-hat users...
  setSignedCookie(context.res, { publicOfficerEmployments })
  return {
    publicOfficerEmployments,
  }
}
