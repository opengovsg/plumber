import appConfig from '@/config/app'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import { ssoClient } from '@/helpers/sso-client'
import { setSsoLoginCookie } from '@/helpers/sso-login'

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

  // IdP-initiated login (OIDC Core §4). Never follow an attacker-named issuer.
  const iss = params.input?.iss
  if (iss && iss !== appConfig.sso.issuer) {
    throw new Error('SSO issuer mismatch')
  }

  const { url, transaction } = await ssoClient.createAuthorizationRequest()
  setSsoLoginCookie(context.res, transaction)

  return {
    authorizationUrl: url,
  }
}

export default startSsoLogin
