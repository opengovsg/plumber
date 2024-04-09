import { deleteAuthCookie } from '@/helpers/auth'

import type { MutationResolvers } from '../__generated__/types.generated'

const logout: MutationResolvers['logout'] = async (
  _parent,
  _params,
  context,
) => {
  deleteAuthCookie(context.res)
  return true
}

export default logout
