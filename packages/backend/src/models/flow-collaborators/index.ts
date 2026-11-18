import { IFlowCollabRole, IGlobalVariable } from '@plumber/types'
import { Transaction } from 'objection'

import { ForbiddenError } from '@/errors/graphql-errors'
import StepError from '@/errors/step'
import { checkUserPermission } from '@/helpers/check-user-permission'

import Base from '../base'
import Flow from '../flow'
import User from '../user'
import BaseFlowCollaborator from './base'

// Reuse the same role type as tables for consistency

class FlowCollaborator extends BaseFlowCollaborator {
  user!: User
  flow!: Flow

  // Virtual field for GraphQL compatibility - populated by custom resolver
  // Email is guaranteed to be available when user relation is loaded
  email!: string

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
        )
      }
      throw new ForbiddenError(
        'You do not have sufficient permissions for this pipe',
      )
    } else {
      return collaborator.role
    }
  }

  static getCollaborators = async ({
    flowId,
    trx,
  }: {
    flowId: string
    trx?: Transaction
  }) => {
    return await this.query(trx)
      .where({ flow_id: flowId })
      .withGraphFetched('user')
  }

  static deleteCollaborator = async ({
    userId,
    flowId,
    trx,
  }: {
    userId: string
    flowId: string
    trx?: Transaction
  }) => {
    return await this.query(trx)
      .delete()
      .where({ user_id: userId, flow_id: flowId })
      .returning('*')
      .throwIfNotFound({ message: 'No such collaborator found' })
  }

  static upsertCollaborator = async ({
    userId,
    flowId,
    role,
    updatedBy,
    trx,
  }: {
    userId: string
    flowId: string
    role: IFlowCollabRole
    updatedBy: string
    trx?: Transaction
  }) => {
    const collaboratorExists = await this.query(trx)
      .findOne({ user_id: userId, flow_id: flowId })
      .withSoftDeleted()

    if (collaboratorExists) {
      return await collaboratorExists
        .$query(trx)
        .patchAndFetch({
          role,
          deletedAt: null,
          updatedBy,
        })
        .withSoftDeleted()
    } else {
      return await this.query(trx).insert({
        userId,
        flowId,
        role,
        updatedBy,
      })
    }
  }
}

export default FlowCollaborator
