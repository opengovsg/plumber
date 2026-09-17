import {
  deleteAuthCookie,
  getParsedAuthCookie,
  invalidateAuthCookie,
} from '@/helpers/auth'

import type { MutationResolvers } from '../__generated__/types.generated'

const logout: MutationResolvers['logout'] = async (
  _parent,
  _params,
  context,
) => {
  const { isSso } = getParsedAuthCookie(context.req)
  // Revoke server-side in addition to clearing the cookie, so a captured
  // pre-logout token can't keep authenticating requests.
  await invalidateAuthCookie(context.req)
  deleteAuthCookie(context.res)
  return {
    isSso,
  }
}

export default logout
