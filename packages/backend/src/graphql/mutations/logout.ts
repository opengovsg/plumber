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
  // Server-side revoke before clearing the cookie. If revoke throws, the
  // cookie is deliberately left uncleared and the mutation reports failure.
  await invalidateAuthCookie(context.req)
  deleteAuthCookie(context.res)
  return {
    isSso,
  }
}

export default logout
