import { IFlowCollabRole, IGlobalVariable } from '@plumber/types'

import { Transaction } from 'objection'

import { ForbiddenError } from '@/errors/graphql-errors'
import StepError from '@/errors/step'
import { checkUserPermission } from '@/helpers/check-user-permission'

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

  /**
   * Checks whether user has the necessary role to access the flow
   * permission levels: viewer, editor, owner
   */
  static hasAccess = async ({
    userId,
    flowId,
    requiredRole,
    $ = undefined,
    trx,
  }: {
    userId: string
    flowId: string
    requiredRole: IFlowCollabRole
    $?: IGlobalVariable
    trx?: Transaction
  }): Promise<IFlowCollabRole | never> => {
    // flow owner is identified by the flow.userId

    const flowOwner = await Flow.query(trx)
      .findOne({
        id: flowId,
      })
      .throwIfNotFound({ message: 'Flow not found' })

    if (flowOwner?.userId === userId) {
      return 'owner'
    }

    // only collaborators need to be checked against flow_collaborators table
    const collaborator = await this.query(trx).findOne({
      user_id: userId,
      flow_id: flowId,
    })

    if (
      !collaborator ||
      !checkUserPermission(collaborator.role, requiredRole)
    ) {
      if ($) {
        throw new StepError(
          'You do not have sufficient permissions for this pipe',
          `Please ensure that you are ${
            requiredRole === 'viewer' ? 'a' : 'an'
          } ${requiredRole} of this pipe.`,
          $.step.position,
          $.app.name,
        )
      }
      throw new ForbiddenError(
        'You do not have sufficient permissions for this pipe',
      )
    } else {
      return collaborator.role
    }
  }

  static hasCollaborators = async ({ flowId }: { flowId: string }) => {
    const collaborators = await this.query()
      .where({
        flow_id: flowId,
      })
      .whereNull('deleted_at')
    return collaborators.length > 0
  }
}

export default FlowCollaborator
