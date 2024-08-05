import User from '@/models/user'

import type { AdminQueryResolvers } from '../../__generated__/types.generated'

const MIN_QUERY_CHARS = 3

const searchUsersByEmail: AdminQueryResolvers['searchUsersByEmail'] = async (
  _parent,
  params,
  _context,
) => {
  const { query } = params

  if (!query || query.trim().length < MIN_QUERY_CHARS) {
    throw new Error(`Query needs to be at least ${MIN_QUERY_CHARS} characters.`)
  }

  return User.query().where('email', 'like', `%${query.toLowerCase()}%`)
}

export default searchUsersByEmail
