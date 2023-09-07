import { SgidClient } from '@opengovsg/sgid-client'

import appConfig from '@/config/app'
import { setAuthCookie } from '@/helpers/cookie'
import User from '@/models/user'
import type Context from '@/types/express/context'

const sgidClient = new SgidClient({
  clientId: appConfig.sgid.clientId,
  clientSecret: appConfig.sgid.clientSecret,
  privateKey: appConfig.sgid.privateKey,
  redirectUri: `${appConfig.webAppUrl}/login/sgid/redirect`,
})

interface PublicOfficerEmployment {
  workEmail: string
  agencyName: string
  departmentName: string
  employmentType: string
  employmentTitle: string
}

interface LoginWithSgidParams {
  input: { authCode: string; nonce: string; verifier: string }
}

interface LoginWithSgidResult {
  nextUrl: string
}

export default async function loginWithSgid(
  _parent: unknown,
  params: LoginWithSgidParams,
  context: Context,
): Promise<LoginWithSgidResult> {
  const { authCode, nonce, verifier } = params.input

  const { accessToken, sub } = await sgidClient.callback({
    code: authCode,
    nonce,
    codeVerifier: verifier,
  })
  const userInfo = await sgidClient.userinfo({ accessToken, sub })

  if (!userInfo) {
    throw new Error('Unable to obtain user info')
  }

  const publicOfficerEmployments = JSON.parse(
    userInfo.data?.['pocdex.public_officer_employments'] ?? '[]',
  ) as PublicOfficerEmployment[]

  //
  // Start trying to log user in...
  //
  // FIXME (ogp-weeloong): figure out a better way to share routes between front
  // end and back end
  //

  // Back to OTP if we couldn't find anything on POCDEX...
  if (publicOfficerEmployments.length === 0) {
    return {
      nextUrl: `${appConfig.webAppUrl}/login/sgid/failed`,
    }
  }

  // Log user in directly if there is only 1 employment.
  if (publicOfficerEmployments.length === 1) {
    const email = publicOfficerEmployments[0].workEmail.trim().toLowerCase()

    let user = await User.query().findOne({ email })
    if (!user) {
      user = await User.query().insertAndFetch({ email })
    }

    setAuthCookie(context.res, { userId: user.id })
    return {
      nextUrl: `${appConfig.webAppUrl}/flows`,
    }
  }

  // Handle multi-hat users.
  // TODO next PR: Let user choose identity if they have more than 1 hat. For
  // now, just throw them back to OTP page.
  return {
    nextUrl: `${appConfig.webAppUrl}/login/sgid/failed`,
  }
}
