import { ITableColumnConfig } from '@plumber/types'

import Base from './base'
import TableMetadata from './table-metadata'

class TableColumnMetadata extends Base {
  id!: string
  tableId!: string
  name: string
  position: number
  config: ITableColumnConfig
  table!: TableMetadata

  static tableName = 'table_column_metadata'

  static jsonSchema = {
    type: 'object',
    // we cant put required id and tableId here because it will throw an error
    // although it will be auto populated by objectionjs
    properties: {
      id: { type: 'string', format: 'uuid' },
      tableId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      position: { type: 'integer' },
      config: { type: 'object' },
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
