import {
  getOrCreateUser,
  sendOnboardingEmail,
  setAuthCookie,
  updateLastLogin,
} from '@/helpers/auth'
import logger from '@/helpers/logger'
import { ssoClient } from '@/helpers/sso-client'

import type { MutationResolvers } from '../__generated__/types.generated'

const loginWithSso: MutationResolvers['loginWithSso'] = async (
  _parent,
  params,
  context,
) => {
  const { authCode, nonce, verifier } = params.input

  try {
    const { accessToken, sub } = await ssoClient.callback({
      code: authCode,
      nonce,
      codeVerifier: verifier,
    })
    const userInfo = await ssoClient.userinfo({
      accessToken,
      sub,
    })

    if (!userInfo) {
      throw new Error('Received nullish user info')
    }

    const user = await getOrCreateUser(userInfo.email)
    await sendOnboardingEmail(user)
    await updateLastLogin(user.id)
    setAuthCookie(context.res, { userId: user.id })
  } catch (error) {
    // Small log event to make it easier to get pulse on sgid error rate.
    logger.error('SSO: Unable to query user info', {
      event: 'sso-login-failed-user-info',
    })

    throw error
  }

  return true
}

export default loginWithSso
