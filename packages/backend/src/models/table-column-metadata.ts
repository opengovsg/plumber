import Base from './base'
import TableMetadata from './table-metadata'

class TableColumnMetadata extends Base {
  id!: string
  tableId!: string
  name: string
  table!: TableMetadata

  static tableName = 'table_column_metadata'

  static jsonSchema = {
    type: 'object',
    required: ['id', 'tableId'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      tableId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
    },
  }

  static relationMappings = () => ({
    table: {
      relation: Base.BelongsToOneRelation,
      modelClass: TableMetadata,
      join: {
        from: `${this.tableName}.table_id`,
        to: `${TableColumnMetadata.tableName}.id`,
      },
    },
  })
}

export default TableColumnMetadata
