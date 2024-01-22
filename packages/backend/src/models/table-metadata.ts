import { ITableCollabRole } from '@plumber/types'

import Base from './base'
import TableCollaborator from './table-collaborators'
import TableColumnMetadata from './table-column-metadata'
import User from './user'

class TableMetadata extends Base {
  id!: string
  name: string
  collaborators!: User[]
  columns: TableColumnMetadata[]
  accessedAt!: Date

  /**
   * for typescript support when creating TableCollaborator row in insertGraph
   */
  role?: ITableCollabRole

  static tableName = 'table_metadata'

  static jsonSchema = {
    type: 'object',
    // we cant put required id and userId here because it will throw an error
    // although it will be auto populated by objectionjs
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
    },
  }

  static relationMappings = () => ({
    collaborators: {
      relation: Base.ManyToManyRelation,
      modelClass: User,
      join: {
        from: `${this.tableName}.id`,
        through: {
          modelClass: TableCollaborator,
          from: `${TableCollaborator.tableName}.table_id`,
          to: `${TableCollaborator.tableName}.user_id`,
          extra: {
            role: 'role',
          },
        },
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

  async validateRows(dataArray: Record<string, unknown>[]): Promise<boolean> {
    const columns = await this.$relatedQuery('columns')
    const columnIdsSet = new Set(columns.map((column) => column.id))

    // Ensure that all keys in data are valid column ids
    for (const data of dataArray) {
      for (const key of Object.keys(data)) {
        if (!columnIdsSet.has(key)) {
          return false
        }
      }
    }
    return true
  }

  /**
   * Maps column ids to column names
   * Strips away any keys that are not column ids
   */
  async mapColumnIdsToNames(
    data: Record<string, string>,
  ): Promise<Record<string, string>> {
    const columns = await this.$relatedQuery('columns')
    const columnMap = new Map(columns.map((column) => [column.id, column.name]))

    const mappedData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      if (columnMap.get(key)) {
        mappedData[columnMap.get(key)] = value
      }
    }
    return mappedData
  }
}

export default TableMetadata
