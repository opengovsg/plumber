import User from '@/models/user'
import { UnauthenticatedContext } from '@/types/express/context'

const getCurrentUser = async (
  _parent: unknown,
  _params: unknown,
  context: UnauthenticatedContext,
): Promise<User | null> => {
  return context.currentUser
}

export default getCurrentUser
