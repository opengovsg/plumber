import { IGlobalVariable, ITableCollabRole } from '@plumber/types'

import { Transaction } from 'objection'

import { ForbiddenError } from '@/errors/graphql-errors'
import StepError from '@/errors/step'

import Base from './base'
import TableMetadata from './table-metadata'
import User from './user'

const TILE_COLLAB_ROLES = ['owner', 'editor', 'viewer']

class TableCollaborator extends Base {
  userId!: string
  tableId!: string
  role!: ITableCollabRole
  user!: User
  table!: TableMetadata
  lastAccessedAt?: string

  static tableName = 'table_collaborators'

  static jsonSchema = {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid' },
      tableId: { type: 'string', format: 'uuid' },
      name: { type: 'string', format: 'uuid' },
      role: { type: 'string', enum: TILE_COLLAB_ROLES },
      lastAccessedAt: { type: 'string', format: 'date-time' },
    },
  }

  // Acts as a composite primary key
  // ref: https://vincit.github.io/objection.js/recipes/composite-keys.html#examples
  static get idColumn() {
    return ['user_id', 'table_id']
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
    columns: {
      relation: Base.BelongsToOneRelation,
      modelClass: TableMetadata,
      join: {
        from: `${this.tableName}.id`,
        to: `${TableMetadata.tableName}.table_id`,
      },
    },
  })

  static hasAccess = async (
    userId: string,
    tableId: string,
    role: ITableCollabRole,
    $?: IGlobalVariable,
  ): Promise<void | never> => {
    const collaborator = await this.query().findOne({
      user_id: userId,
      table_id: tableId,
    })
    if (
      !collaborator ||
      TILE_COLLAB_ROLES.indexOf(collaborator.role) >
        TILE_COLLAB_ROLES.indexOf(role)
    ) {
      if ($) {
        throw new StepError(
          'You do not have sufficient permissions for this tile',
          `Please ensure that you are ${
            role === 'viewer' ? 'a' : 'an'
          } ${role} of this tile.`,
          $.step.position,
          $.app.name,
        )
      }
      throw new ForbiddenError(
        'You do not have sufficient permissions for this tile',
      )
    }
  }

  static upgradeOrInsertCollaborator = async ({
    userId,
    tableId,
    role,
    trx,
  }: {
    userId: string
    tableId: string
    role: ITableCollabRole
    trx?: Transaction
  }) => {
    const existingCollaborator = await TableCollaborator.query(trx)
      .findOne({
        table_id: tableId,
        user_id: userId,
      })
      .withSoftDeleted()

    /**
     * Upgrade or insert collaborator here
     */
    if (existingCollaborator) {
      const currentRoleIndex = TILE_COLLAB_ROLES.indexOf(
        existingCollaborator.role,
      )
      const newRoleIndex = TILE_COLLAB_ROLES.indexOf(role)

      /**
       * No-op if new role is less or equally permissive to current role.
       * - Owner role cannot be changed
       * - Tile collaborators should not be downgraded when Pipe collaborator is downgraded
       * Only applies to active collaborators; soft-deleted ones should be restored with the new role.
       */
      if (!existingCollaborator.deletedAt && newRoleIndex >= currentRoleIndex) {
        return
      }

      await existingCollaborator
        .$query(trx)
        .patchAndFetch({
          role,
          deletedAt: null,
        })
        .withSoftDeleted()
    } else {
      await TableCollaborator.query(trx).insert({
        tableId,
        userId,
        role,
      })
    }
  }
}

export default TableCollaborator
