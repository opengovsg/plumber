import {
  deleteAuthCookie,
  getParsedAuthCookie,
  invalidateAuthCookie,
} from '@/helpers/auth'

import type { MutationResolvers } from '../__generated__/types.generated'

const logout: NonNullable<MutationResolvers['logout']> = async (
  _parent,
  _params,
  context,
) => {
  const authCookie = getParsedAuthCookie(context.req)
  // The isAuthenticated rule only lets requests with a valid auth cookie through.
  if (!authCookie) {
    throw new Error('Missing auth cookie on logout')
  }
  const { isSso } = authCookie
  // Server-side revoke before clearing the cookie. If revoke throws, the
  // cookie is deliberately left uncleared and the mutation reports failure.
  await invalidateAuthCookie(context.req)
  deleteAuthCookie(context.res)
  return {
    isSso,
  }
}

export default logout
