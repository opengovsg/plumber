import { getLdFlagValue } from '@/helpers/launch-darkly'
import { ssoClient } from '@/helpers/sso-client'
import { sanitizeInternalPath, setSsoLoginCookie } from '@/helpers/sso-login'

import type { MutationResolvers } from '../__generated__/types.generated'

const startSsoLogin: MutationResolvers['startSsoLogin'] = async (
  _parent,
  params,
  context,
) => {
  const ssoEnabled = await getLdFlagValue<boolean>(
    'ogp-sso-enabled',
    null,
    false,
  )

  if (!ssoEnabled) {
    throw new Error('SSO is not enabled')
  }

  const redirect = sanitizeInternalPath(params.input?.redirect)
  const { url, transaction } = await ssoClient.createAuthorizationRequest(
    redirect,
  )
  setSsoLoginCookie(context.res, transaction)

  return {
    authorizationUrl: url,
  }
}

export default startSsoLogin
