import { randomUUID } from 'crypto'
import { Knex } from 'knex'

import { tilesClient } from '@/config/tiles-database'
import logger from '@/helpers/logger'

import {
  CreateRowInput,
  CreateRowsInput,
  DeleteRowsInput,
  PatchRowInput,
  TableRowFilter,
  TableRowFilterOperator,
  TableRowItem,
  TableRowOutput,
  UpdateRowInput,
} from '../types'

/**
 * External functions
 */

export const createTableRow = async ({
  tableId,
  data,
}: CreateRowInput): Promise<TableRowItem> => {
  try {
    const res = await tilesClient(tableId)
      .insert({
        ...data,
        rowId: randomUUID(),
      })
      .returning('*')
    return res[0]
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

export const createTableRows = async ({
  tableId,
  dataArray,
}: CreateRowsInput): Promise<string[]> => {
  try {
    const rows = dataArray.map((data, i) => ({
      rowId: randomUUID(),
      ...data,
      // manually bumping the createdAt timestamp to ensure that row order is preserved
      createdAt: new Date(Date.now() + i),
    }))
    const res = await tilesClient(tableId).insert(rows).returning(['rowId'])
    return res.map((row) => row.rowId)
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

/**
 * This replaces the entire data object for the row
 */
export const updateTableRow = async ({
  rowId,
  tableId,
  data,
}: UpdateRowInput): Promise<void> => {
  try {
    await tilesClient(tableId)
      .where({
        rowId,
      })
      .update(data)
      .update('updatedAt', new Date())
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

/**
 * This atomically updates the data object for keys that are changed
 */
export const patchTableRow = async ({
  rowId,
  tableId,
  patchData,
}: PatchRowInput): Promise<TableRowItem> => {
  try {
    const query = tilesClient(tableId).where({ rowId })

    Object.entries(patchData.set || {}).forEach(
      ([key, value]: [string, string]) => {
        query.update(key, value)
      },
    )

    Object.entries(patchData.add || {}).forEach(
      ([key, value]: [string, string]) => {
        if (isNaN(+value)) {
          throw new Error(`Invalid value for add operation: ${value}`)
        }
        query
          .update(
            key,
            tilesClient.raw('(CAST(?? AS double precision) + ?)::text', [
              key,
              +value,
            ]),
          )
          .where(key, '~', '^[-+]?\\d*\\.?\\d+$')
      },
    )

    Object.entries(patchData.subtract || {}).forEach(
      ([key, value]: [string, string]) => {
        if (isNaN(+value)) {
          throw new Error(`Invalid value for subtract operation: ${value}`)
        }
        query
          .update(
            key,
            tilesClient.raw('(CAST(?? AS double precision) - ?)::text', [
              key,
              +value,
            ]),
          )
          .where(key, '~', '^[-+]?\\d*\\.?\\d+$')
      },
    )

    const res = await query.update('updatedAt', new Date()).returning('*')
    return res[0]
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

export const deleteTableRows = async ({
  rowIds,
  tableId,
}: DeleteRowsInput): Promise<void> => {
  try {
    await tilesClient.into(tableId).whereIn('rowId', rowIds).delete()
    return
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

export const getTableRowCount = async ({
  tableId,
}: {
  tableId: string
}): Promise<number> => {
  try {
    const res = await tilesClient(tableId).count({ count: '*' })
    return res[0].count
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

function addFiltersToQuery(
  query: Knex.QueryBuilder,
  filters: TableRowFilter[],
) {
  for (const filter of filters) {
    switch (filter.operator) {
      case TableRowFilterOperator.Equals:
        query.where(filter.columnId, '=', filter.value)
        break
      case TableRowFilterOperator.Contains:
        query.where(filter.columnId, 'ilike', `%${filter.value}%`)
        break
      case TableRowFilterOperator.GreaterThan:
        query.where(filter.columnId, '>', filter.value)
        break
      case TableRowFilterOperator.GreaterThanOrEquals:
        query.where(filter.columnId, '>=', filter.value)
        break
      case TableRowFilterOperator.LessThan:
        query.where(filter.columnId, '<', filter.value)
        break
      case TableRowFilterOperator.LessThanOrEquals:
        query.where(filter.columnId, '<=', filter.value)
        break
      case TableRowFilterOperator.IsEmpty:
        query.where((builder) => {
          builder.whereNull(filter.columnId).orWhere(filter.columnId, '')
        })
        break
      case TableRowFilterOperator.BeginsWith:
        query.where(filter.columnId, 'ilike', `${filter.value}%`)
        break
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`)
    }
  }
}

export const getTableRows = async ({
  tableId,
  columnIds,
  filters,
  order = 'asc',
  scanLimit,
}: {
  tableId: string
  columnIds?: string[]
  filters?: TableRowFilter[]
  order?: 'asc' | 'desc'
  /**
   * Optional limit on the total number of rows scanned.
   */
  scanLimit?: number
}): Promise<{
  rows: TableRowOutput[]
}> => {
  const query = tilesClient(tableId).select(
    columnIds ? ['rowId', ...columnIds] : ['*'],
  )
  if (filters) {
    addFiltersToQuery(query, filters)
  }
  if (scanLimit) {
    query.limit(scanLimit)
  }
  try {
    const tableRows = []
    const stream = query.orderBy('createdAt', order).stream()
    for await (const row of stream) {
      const { rowId, ...rest } = row
      tableRows.push({ rowId, data: rest })
    }
    return {
      rows: tableRows,
    }
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

/**
 * Column IDs are unmapped
 */
export const getRawRowById = async ({
  tableId,
  rowId,
  columnIds,
}: {
  tableId: string
  rowId: string
  columnIds?: string[]
}): Promise<TableRowOutput | null> => {
  try {
    const res = await tilesClient(tableId)
      .where({
        rowId,
      })
      .select(columnIds ? ['rowId', ...columnIds] : ['*'])
      .first()
    return res
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}
