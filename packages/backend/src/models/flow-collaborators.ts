import { IFlowCollabRole } from '@plumber/types'

import Base from './base'
import Flow from './flow'
import User from './user'

// Reuse the same role type as tables for consistency

class FlowCollaborator extends Base {
  userId!: string
  flowId!: string
  role!: IFlowCollabRole
  user!: User
  flow!: Flow
  lastAccessedAt?: string
  updatedBy?: string

  // Virtual field for GraphQL compatibility - populated by custom resolver
  // Email is guaranteed to be available when user relation is loaded
  email: string

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

  // Acts as a composite primary key
  static get idColumn() {
    return ['user_id', 'flow_id']
  }

  static relationMappings = () => ({
    user: {
      relation: Base.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: `${this.tableName}.user_id`,
        to: `${User.tableName}.id`,
      },
    },
    flow: {
      relation: Base.BelongsToOneRelation,
      modelClass: Flow,
      join: {
        from: `${this.tableName}.flow_id`,
        to: `${Flow.tableName}.id`,
      },
    },
  })
}

export default FlowCollaborator
