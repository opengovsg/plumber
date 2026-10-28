import type { IJSONObject, TileTemplateData } from '@plumber/types'
import { z } from 'zod'

import {
  TILE_COL_DATA_KEY,
  TILE_COL_POS_KEY,
  TILE_ID_KEY,
} from '@/db/storage/constants'
import logger from '@/helpers/logger'
import { getTableOperations } from '@/models/tiles/factory'

import type { TemplateDataHandler } from './types'

const tileTemplateDataSchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
  rowData: z.array(z.record(z.string(), z.json())).optional(),
}) satisfies z.ZodType<TileTemplateData>

// This replaces the keys of columns which are names to the column ids for row data
// e.g. { Rating: 5 } --> { column_id: 5 }
function replaceColumnNamesWithIds(
  rowData: IJSONObject[],
  columnNameToIdMap: Record<string, string>,
) {
  const replacedRowData: IJSONObject[] = []
  for (const row of rowData) {
    const newRow: IJSONObject = {}
    for (const key in row) {
      if (!columnNameToIdMap[key]) {
        throw new Error(
          `Unable to find tiles column id for specified column name: ${key} when inserting row data`,
        )
      }
      const newKey = columnNameToIdMap[key]
      newRow[newKey] = row[key]
    }
    replacedRowData.push(newRow)
  }
  return replacedRowData
}

export const tileTemplateDataHandler: TemplateDataHandler<TileTemplateData> = {
  schema: tileTemplateDataSchema,
  async create({ user, templateData, position, trx }) {
    const { name, columns, rowData } = templateData
    try {
      // Inside trx so a failed Postgres table creation rolls back the metadata.
      const table = await user.$relatedQuery('tables', trx).insertGraph({
        name,
        role: 'owner',
        db: 'pg',
        columns: columns.map((column, index) => ({
          name: column,
          position: index,
        })),
      })

      const columnIds = [...table.columns]
        .sort((a, b) => a.position - b.position)
        .map((column) => column.id)
      const columnNameToIdMap: Record<string, string> = {}
      for (const tableColumn of table.columns) {
        columnNameToIdMap[tableColumn.name] = tableColumn.id
      }

      const tableOperations = getTableOperations('pg')
      await tableOperations.createTable(table.id, columnIds)
      if (rowData?.length) {
        await tableOperations.createTableRows({
          tableId: table.id,
          dataArray: replaceColumnNamesWithIds(rowData, columnNameToIdMap),
        })
      }

      return {
        placeholders: {
          [TILE_ID_KEY(position)]: table.id,
          [TILE_COL_DATA_KEY(position)]: columnNameToIdMap,
          [TILE_COL_POS_KEY(position)]: columnIds,
        },
        templateConfig: { tileId: table.id },
      }
    } catch (e) {
      logger.error(e)
      throw new Error('Creation of tile ran into an issue')
    }
  },
}
