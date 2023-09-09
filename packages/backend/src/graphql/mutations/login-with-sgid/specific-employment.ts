import { type Request } from 'express'
import { verify as verifyJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import type Context from '@/types/express/context'

import {
  type LoginWithSgidResult,
  type PublicOfficerEmployment,
  SGID_COOKIE_NAME,
  type SpecificEmploymentParams,
} from './common'

function readEmploymentsFromCookie(req: Request): PublicOfficerEmployment[] {
  const token = req.cookies[SGID_COOKIE_NAME]
  const data = verifyJwt(token, appConfig.sgid.jwtKey) as {
    publicOfficerEmployments: PublicOfficerEmployment[]
  }

  return data.publicOfficerEmployments
}

export async function processSpecificEmployment(
  params: SpecificEmploymentParams,
  context: Context,
): Promise<LoginWithSgidResult> {
  const employments = readEmploymentsFromCookie(context.req)
  context.res.clearCookie(SGID_COOKIE_NAME)

  const { employmentIndex } = params

  if (
    employmentIndex < 0 ||
    !Number.isInteger(employmentIndex) ||
    employmentIndex >= employments.length
  ) {
    throw new Error('Invalid index')
  }

  // employments[employmentIndex].workEmail guaranteed nonnull, see
  // onInitialStep.
  const user = await getOrCreateUser(employments[employmentIndex].workEmail)
  setAuthCookie(context.res, { userId: user.id })
  return {
    nextUrl: `${appConfig.webAppUrl}/flows`,
  }
}
