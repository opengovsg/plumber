import Base from './base'
import TableColumnMetadata from './table-column-metadata'
import User from './user'

class TableMetadata extends Base {
  id!: string
  userId!: string
  name: string
  user!: User
  columns: TableColumnMetadata[]

  static tableName = 'table_metadata'

  static jsonSchema = {
    type: 'object',
    required: ['id', 'userId'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
    },
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
      relation: Base.HasManyRelation,
      modelClass: TableColumnMetadata,
      join: {
        from: `${this.tableName}.id`,
        to: `${TableColumnMetadata.tableName}.table_id`,
      },
    },
  })
}

export default TableMetadata
