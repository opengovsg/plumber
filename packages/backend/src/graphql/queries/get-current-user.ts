import Context from '../../types/express/context'

const getCurrentUser = async (
  _parent: unknown,
  _params: unknown,
  context: Context,
) => {
  // prevent fetching of other user data
  const { id, email, createdAt, updatedAt } = context.currentUser
  return {
    id,
    email,
    createdAt,
    updatedAt,
  }
}

export default getCurrentUser
