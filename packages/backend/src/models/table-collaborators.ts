import { ITableCollabRole } from '@plumber/types'

import Base from './base'
import TableMetadata from './table-metadata'
import User from './user'

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
      role: { type: 'string', enum: ['owner', 'editor', 'viewer'] },
      deletedAt: { type: 'null' }, // disallow soft deletes
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
  ): Promise<void | never> => {
    const permissionLevels = ['viewer', 'editor', 'owner']
    const collaborator = await this.query().findOne({
      user_id: userId,
      table_id: tableId,
    })
    if (
      !collaborator ||
      permissionLevels.indexOf(collaborator.role) <
        permissionLevels.indexOf(role)
    ) {
      throw new Error('You do not have access to this tile.')
    }
  }
}

export default TableCollaborator
