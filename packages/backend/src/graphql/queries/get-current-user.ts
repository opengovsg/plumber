import User from '@/models/user'

import type { QueryResolvers } from '../__generated__/types.generated'

const getCurrentUser: NonNullable<QueryResolvers['getCurrentUser']> = async (
  _parent,
  _params,
  context,
): Promise<User | null> => {
  return context.currentUser
}

export default getCurrentUser
