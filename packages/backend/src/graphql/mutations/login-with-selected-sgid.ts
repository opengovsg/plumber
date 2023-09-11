import { type Request } from 'express'
import { verify as verifyJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import logger from '@/helpers/logger'
import {
  type PublicOfficerEmployment,
  SGID_COOKIE_NAME,
  type SgidLoginResult,
} from '@/helpers/sgid'
import type Context from '@/types/express/context'

interface LoginWithSelectedSgidParams {
  input: { workEmail: string }
}

function readEmploymentsFromCookie(req: Request): PublicOfficerEmployment[] {
  const token = req.cookies[SGID_COOKIE_NAME]

  try {
    const data = verifyJwt(token, appConfig.sgid.jwtKey) as {
      publicOfficerEmployments: PublicOfficerEmployment[]
    }
    return data.publicOfficerEmployments
  } catch (error) {
    logger.error('Could not validate sgid multi-hat cookie', {
      event: 'sgid-login-failed-cookie-validation',
      rawToken: token,
    })
    throw error
  }
}

export default async function LoginWithSelectedSgid(
  params: LoginWithSelectedSgidParams,
  context: Context,
): Promise<SgidLoginResult> {
  const employments = readEmploymentsFromCookie(context.req)
  context.res.clearCookie(SGID_COOKIE_NAME)

  const workEmail = params.input.workEmail

  const employment = employments.find(
    (employment) => employment.workEmail === workEmail,
  )

  if (!employment) {
    throw new Error('Invalid work email')
  }

  const user = await getOrCreateUser(workEmail)
  setAuthCookie(context.res, { userId: user.id })

  return {
    publicOfficerEmployments: [employment],
  }
}
