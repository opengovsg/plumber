import { SgidClient } from '@opengovsg/sgid-client'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import type Context from '@/types/express/context'

const sgidClient = new SgidClient({
  clientId: appConfig.sgid.clientId,
  clientSecret: appConfig.sgid.clientSecret,
  privateKey: appConfig.sgid.privateKey,
  redirectUri: `${appConfig.webAppUrl}/login/sgid/redirect`,
})

interface PublicOfficerEmployment {
  workEmail: string | null
  agencyName: string | null
  departmentName: string | null
  employmentType: string | null
  employmentTitle: string | null
}

interface LoginWithSgidParams {
  input: { authCode: string; nonce: string; verifier: string }
}

interface LoginWithSgidResult {
  nextUrl: string
}

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
      nextUrl: `${appConfig.webAppUrl}/login/sgid/failed`,
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

  // Handle multi-hat users.
  // TODO next PR: Let user choose identity if they have more than 1 hat. For
  // now, just throw them back to OTP page.
  return {
    nextUrl: `${appConfig.webAppUrl}/login/sgid/failed`,
  }
}
