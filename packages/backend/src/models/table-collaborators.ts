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

  static tableName = 'table_collaborators'

  static jsonSchema = {
    type: 'object',
    // we cant put required id and userId here because it will throw an error
    // although it will be auto populated by objectionjs
    properties: {
      userId: { type: 'string', format: 'uuid' },
      name: { type: 'string', format: 'uuid' },
      role: { type: 'string', enum: ['owner', 'editor', 'viewer'] },
      deletedAt: { type: 'null' }, // disallow soft deletes
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
}

export default TableCollaborator
