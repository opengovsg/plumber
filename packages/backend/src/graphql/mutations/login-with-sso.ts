import {
  getOrCreateUser,
  sendOnboardingEmail,
  setAuthCookie,
  updateLastLogin,
} from '@/helpers/auth'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { ssoClient } from '@/helpers/sso-client'

import type { MutationResolvers } from '../__generated__/types.generated'

const loginWithSso: MutationResolvers['loginWithSso'] = async (
  _parent,
  params,
  context,
) => {
  const { authCode, nonce, verifier } = params.input

  const ssoEnabled = await getLdFlagValue<boolean>(
    'ogp-sso-enabled',
    null,
    false,
  )

  if (!ssoEnabled) {
    throw new Error('SSO is not enabled')
  }

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

    const userEmail = userInfo.email.toLowerCase().trim()

    // TODO: Remove this once it's public release
    if (!userEmail.endsWith('@open.gov.sg')) {
      throw new Error('Only OGP officers are allowed to login with SSO')
    }

    const user = await getOrCreateUser(userEmail)
    await sendOnboardingEmail(user)
    await updateLastLogin(user.id)
    setAuthCookie(context.res, { userId: user.id, isSso: true })
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
