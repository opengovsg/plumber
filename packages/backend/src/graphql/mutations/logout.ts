import { deleteAuthCookie, getParsedAuthCookie } from '@/helpers/auth'

import type { MutationResolvers } from '../__generated__/types.generated'

const logout: MutationResolvers['logout'] = async (
  _parent,
  _params,
  context,
) => {
  const { isSso } = getParsedAuthCookie(context.req)
  deleteAuthCookie(context.res)
  return {
    isSso,
  }
}

export default logout
