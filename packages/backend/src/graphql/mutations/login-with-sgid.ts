import { type UserInfoReturn as SgidUserInfoReturn } from '@opengovsg/sgid-client'
import { type Response } from 'express'
import { sign as signJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import logger from '@/helpers/logger'
import {
  type PublicOfficerEmployment,
  SGID_MULTI_HAT_COOKIE_NAME,
  SGID_MULTI_HAT_COOKIE_TTL_SECONDS,
  sgidClient,
} from '@/helpers/sgid'

import type { MutationResolvers } from '../__generated__/types.generated'

function setSignedCookie<T extends object>(res: Response, data: T): void {
  const token = signJwt(data, appConfig.sessionSecretKey)
  res.cookie(SGID_MULTI_HAT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: !appConfig.isDev,
    maxAge: SGID_MULTI_HAT_COOKIE_TTL_SECONDS * 1000,
  })
}

// POCDEX returns snake case and 'NA' instead of null
interface RawPocdexData {
  work_email: string | 'NA'
  agency_name: string | 'NA'
  department_name: string | 'NA'
  employment_type: string | 'NA'
  employment_title: string | 'NA'
}

function makeNaNull(value: string | 'NA'): string | null {
  return value === 'NA' ? null : value
}

async function parsePocdexData(
  pocdexString: string,
): Promise<PublicOfficerEmployment[]> {
  const result: PublicOfficerEmployment[] = []

  // Parse & convert POCDEX data into a more conventional format:
  // * camelCase
  // * null instead of 'NA'
  try {
    for (const pocdexDatum of JSON.parse(pocdexString) as RawPocdexData[]) {
      result.push({
        workEmail: makeNaNull(pocdexDatum.work_email),
        agencyName: makeNaNull(pocdexDatum.agency_name),
        departmentName: makeNaNull(pocdexDatum.department_name),
        employmentType: makeNaNull(pocdexDatum.employment_type),
        employmentTitle: makeNaNull(pocdexDatum.employment_title),
      })
    }
  } catch {
    logger.error('Received malformed data from POCDEX', {
      event: 'sgid-login-malformed-pocdex',
      pocdexString,
    })
    throw new Error('Received malformed data from POCDEX')
  }

  // Ignore entries with bad work emails.
  const validResults = await Promise.all(
    result.map(
      async (employment) =>
        employment.workEmail &&
        (await validateAndParseEmail(employment.workEmail)),
    ),
  )
  return result.filter((_, index) => validResults[index])
}

/**
 * Success or failure of the login can be determined by the length of the
 * returned publicOfficerEmployments array.
 * - Length = 0: Login failed, we could not find any valid POCDEX data.
 * - Length = 1: Login success, we will return the POCDEX entry used to login.
 * - Length > 1: Multi-hat user; we need the user to select which work email
 *               to login.
 */
const loginWithSgid: MutationResolvers['loginWithSgid'] = async (
  _parent,
  params,
  context,
) => {
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

  const publicOfficerEmployments = await parsePocdexData(
    userInfo.data?.['pocdex.public_officer_details'] ?? '[]',
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

export default loginWithSgid
