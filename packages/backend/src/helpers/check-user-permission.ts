import type { IFlowCollabRole } from '@plumber/types'

import { ForbiddenError } from '@/errors/graphql-errors'

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
  throw new ForbiddenError('You do not have sufficient permissions')
}
