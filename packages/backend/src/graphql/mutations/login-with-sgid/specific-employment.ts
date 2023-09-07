import { type Request } from 'express'
import jwt from 'jsonwebtoken'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import type Context from '@/types/express/context'

import {
  type LoginWithSgidResult,
  type PublicOfficerEmployment,
  SGID_COOKIE_NAME,
  type SpecificEmployment,
} from './common'

function readEmploymentsFromCookie(req: Request): PublicOfficerEmployment[] {
  const token = req.cookies[SGID_COOKIE_NAME]
  const data = jwt.verify(token, appConfig.sgid.jwtKey) as {
    publicOfficerEmployments: PublicOfficerEmployment[]
  }

  return data.publicOfficerEmployments
}

export async function processSpecificEmployment(
  params: SpecificEmployment,
  context: Context,
): Promise<LoginWithSgidResult> {
  const employments = readEmploymentsFromCookie(context.req)

  // Cookie data is no longer needed after reading.
  context.res.clearCookie(SGID_COOKIE_NAME)

  const isValidEmployment = employments.some(
    (employment) => employment.workEmail === params.workEmail,
  )

  if (!isValidEmployment) {
    return {
      nextUrl: `${appConfig.webAppUrl}/login/sgid/failed`,
    }
  }

  const user = await getOrCreateUser(params.workEmail)
  setAuthCookie(context.res, { userId: user.id })
  return {
    nextUrl: `${appConfig.webAppUrl}/flows`,
  }
}
