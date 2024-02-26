import { type Request } from 'express'
import { verify as verifyJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { getOrCreateUser, setAuthCookie } from '@/helpers/auth'
import logger from '@/helpers/logger'
import {
  type PublicOfficerEmployment,
  SGID_MULTI_HAT_COOKIE_NAME,
} from '@/helpers/sgid'

import type { MutationResolvers } from '../__generated__/types.generated'

function readEmploymentsFromCookie(req: Request): PublicOfficerEmployment[] {
  const token = req.cookies[SGID_MULTI_HAT_COOKIE_NAME]

  try {
    const data = verifyJwt(token, appConfig.sessionSecretKey) as {
      publicOfficerEmployments: PublicOfficerEmployment[]
    }
    return data.publicOfficerEmployments
  } catch (error) {
    logger.error('Could not validate sgid multi-hat cookie', {
      event: 'sgid-login-failed-cookie-validation',
      cookieData: token,
    })
    throw error
  }
}

const loginWithSelectedSgid: NonNullable<
  MutationResolvers['loginWithSelectedSgid']
> = async (_parent, params, context) => {
  const employments = readEmploymentsFromCookie(context.req)
  context.res.clearCookie(SGID_MULTI_HAT_COOKIE_NAME)

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
    success: true,
  }
}

export default loginWithSelectedSgid
