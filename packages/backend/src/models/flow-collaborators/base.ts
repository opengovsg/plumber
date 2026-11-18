import type { IFlowCollabRole } from '@plumber/types'

import Base from '../base'

// IMPORTANT: Holds columns only. The analytics export reads through it without loading the app.
class BaseFlowCollaborator extends Base {
  userId!: string
  flowId!: string
  role!: IFlowCollabRole
  lastAccessedAt?: string
  updatedBy?: string

  static tableName = 'flow_collaborators'

  static jsonSchema = {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid' },
      flowId: { type: 'string', format: 'uuid' },
      role: { type: 'string', enum: ['editor', 'viewer'] },
      lastAccessedAt: { type: 'string', format: 'date-time' },
      updatedBy: { type: 'string', format: 'uuid' },
    },
  }
}

export default BaseFlowCollaborator
