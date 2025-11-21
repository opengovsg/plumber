import type { IFlowCollabRole } from '@plumber/types'

import { ForbiddenError } from '@/errors/graphql-errors'

export const PERMISSION_LEVELS = ['viewer', 'editor', 'owner'] as const

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
  throw new ForbiddenError('You do not have sufficient permissions')
}

export const getAllowedCollaboratorRoles = (
  requiredRole: IFlowCollabRole,
): IFlowCollabRole[] => {
  const requiredIndex = PERMISSION_LEVELS.indexOf(requiredRole)
  // Collaborators can only be 'viewer' or 'editor'. Owners are handled via flows.user_id.
  return (['viewer', 'editor'] as IFlowCollabRole[]).filter(
    (role) => PERMISSION_LEVELS.indexOf(role) >= requiredIndex,
  )
}
