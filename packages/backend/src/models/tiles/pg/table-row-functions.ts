import { Knex } from 'knex'
import { monotonicFactory, ulid } from 'ulid'

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
  TableRowOutputWithTimestamps,
  UpdateRowInput,
} from '../types'

function formatTableRow(
  row: Record<string, string>,
  tableId: string,
): TableRowItem | null {
  if (!row) {
    return null
  }
  const { rowId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = row
  return { rowId, data: rest, tableId }
}

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
        rowId: ulid(),
      })
      .returning('*')

    return formatTableRow(res[0], tableId)
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
    const ulid = monotonicFactory()
    const rows = dataArray.map((data) => ({
      rowId: ulid(),
      ...data,
      // no need to manually bump the createdAt timestamp as the rowId is already sorted
      createdAt: new Date(),
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
    const res = await tilesClient(tableId)
      .where({
        rowId,
      })
      .update(data)
      .update('updatedAt', new Date())
      .returning('rowId')
    if (res.length === 0) {
      throw new Error('Row not found')
    }
    return
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}

/**
 * This atomically updates the data object for keys that are changed
 */
export const patchTableRow = async ({
  rowId: rowIdToUse,
  tableId,
  patchData,
}: PatchRowInput): Promise<TableRowItem> => {
  try {
    const query = tilesClient(tableId).where({ rowId: rowIdToUse })

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
    if (res.length === 0) {
      throw new Error('No rows to patch')
    }
    return formatTableRow(res[0], tableId)
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
  stringifiedCursor,
}: {
  tableId: string
  columnIds?: string[]
  filters?: TableRowFilter[]
  order?: 'asc' | 'desc'
  /**
   * Optional limit on the total number of rows scanned.
   */
  scanLimit?: number
  stringifiedCursor?: string
}): Promise<{
  rows: TableRowOutput[]
  stringifiedCursor: string | null
}> => {
  const query = tilesClient(tableId).select(['rowId', ...(columnIds ?? [])])
  if (filters) {
    addFiltersToQuery(query, filters)
  }
  if (scanLimit) {
    query.limit(scanLimit)
  }
  const offset = stringifiedCursor ? +stringifiedCursor : 0
  if (offset) {
    query.offset(offset)
  }
  try {
    const tableRows = []
    const stream = query.orderBy('rowId', order).stream()
    for await (const row of stream) {
      const { rowId, ...rest } = row
      tableRows.push({ rowId, data: rest })
    }
    return {
      rows: tableRows,
      stringifiedCursor:
        tableRows.length === scanLimit ? (offset + scanLimit).toString() : null,
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
  rowId: rowIdToUse,
  columnIds,
  includeTimestamps = false,
}: {
  tableId: string
  rowId: string
  columnIds?: string[]
  includeTimestamps?: boolean
}): Promise<TableRowOutput | TableRowOutputWithTimestamps | null> => {
  try {
    const columnsToSelect = columnIds ? ['rowId', ...columnIds] : ['*']
    if (includeTimestamps && columnIds) {
      columnsToSelect.push('createdAt', 'updatedAt')
    }
    const res = await tilesClient(tableId)
      .where({
        rowId: rowIdToUse,
      })
      .select(columnsToSelect)
      .first()
    if (!res) {
      return null
    }
    const formattedRow = formatTableRow(res, tableId)
    if (includeTimestamps && formattedRow) {
      return {
        ...formattedRow,
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
      }
    }
    return formattedRow
  } catch (e: unknown) {
    logger.error(e)
    throw e
  }
}
