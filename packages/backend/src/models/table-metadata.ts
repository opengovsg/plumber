import { ITableRow } from '@plumber/types'

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
    // we cant put required id and userId here because it will throw an error
    // although it will be auto populated by objectionjs
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

  async validateRowKeys(data: Record<string, unknown>): Promise<boolean> {
    const columns = await this.$relatedQuery('columns')
    const columnIdsSet = new Set(columns.map((column) => column.id))

    // Ensure that all keys in data are valid column ids
    for (const key of Object.keys(data)) {
      if (!columnIdsSet.has(key)) {
        return false
      }
    }
    return true
  }

  async stripInvalidKeys(rows: ITableRow[]): Promise<ITableRow[]> {
    const columns = await this.$relatedQuery('columns')
    const columnIdsSet = new Set(columns.map((column) => column.id))

    return rows.map((row) => {
      const validKeys = Object.keys(row.data).filter((key) =>
        columnIdsSet.has(key),
      )
      const validData = validKeys.reduce(
        (acc, key) => ({ ...acc, [key]: row.data[key] }),
        {},
      )
      return { ...row, data: validData }
    })
  }
}

export default TableMetadata
