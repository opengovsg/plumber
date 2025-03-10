import { IGlobalVariable, ITableColumnConfig } from '@plumber/types'

import StepError from '@/errors/step'

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

  static getColumns = async (tableId: string, $?: IGlobalVariable) => {
    const columns = await TableColumnMetadata.query()
      .where({
        table_id: tableId,
      })
      .orderBy('position')

    if (columns.length === 0) {
      throw new StepError(
        'Tile not found',
        'Tile may have been deleted. Please check your tile.',
        $.step.position,
        $.app.name,
      )
    }
    return columns
  }
}

export default TableColumnMetadata
