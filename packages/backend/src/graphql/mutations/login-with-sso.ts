import { ForbiddenError } from '@/errors/graphql-errors'
import {
  getOrCreateUser,
  sendOnboardingEmail,
  setAuthCookie,
  updateLastLogin,
} from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { ssoClient } from '@/helpers/sso-client'
import { consumeSsoLoginCookie } from '@/helpers/sso-login'

import type { MutationResolvers } from '../__generated__/types.generated'

const loginWithSso: MutationResolvers['loginWithSso'] = async (
  _parent,
  params,
  context,
) => {
  const { authCode, state, iss } = params.input

  const ssoEnabled = await getLdFlagValue<boolean>(
    'ogp-sso-enabled',
    null,
    false,
  )

  if (!ssoEnabled) {
    throw new Error('SSO is not enabled')
  }

  const transaction = consumeSsoLoginCookie(context.req, context.res)
  if (!transaction || transaction.state !== state) {
    throw new Error('SSO login session is invalid or expired')
  }

  try {
    const identity = await ssoClient.callback({
      code: authCode,
      state,
      iss,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    })

    const userEmail = await validateAndParseEmail(identity.email)
    if (!userEmail) {
      throw new ForbiddenError('You do not have access to Plumber')
    }

    const user = await getOrCreateUser(userEmail)
    await sendOnboardingEmail(user)
    await updateLastLogin(user.id)
    setAuthCookie(context.res, { userId: user.id, isSso: true })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw error
    }

    logger.error('SSO: Unable to complete login', {
      event: 'sso-login-failed-user-info',
    })

    throw error
  }

  return true
}

export default loginWithSso
