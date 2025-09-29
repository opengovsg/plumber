import type { IFlowCollabRole } from '@plumber/types'

const PERMISSION_LEVELS = ['viewer', 'editor', 'owner']

export const checkUserPermission = (
  collaboratorRole: IFlowCollabRole,
  requiredRole: IFlowCollabRole,
) => {
  if (
    PERMISSION_LEVELS.indexOf(collaboratorRole) >=
    PERMISSION_LEVELS.indexOf(requiredRole)
  ) {
    return true
  }
  throw new Error('You do not have the required permissions.')
}
