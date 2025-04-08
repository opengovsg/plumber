import { type QueryCommandOutput } from '@aws-sdk/client-dynamodb'
import { randomUUID } from 'crypto'

import logger from '@/helpers/logger'

import { autoMarshallNumberStrings, handleDynamoDBError } from '../helpers'

import { getSkKeyValue, TableRow } from './model'
import {
  type CreateRowInput,
  type CreateRowsInput,
  type DeleteRowsInput,
  type PatchRowInput,
  type TableRowFilter,
  TableRowFilterOperator,
  type TableRowIndexName,
  type TableRowItem,
  type TableRowOutput,
  type UpdateRowInput,
} from './types'

const MAX_RETRIES = 8
const EXPONENTIAL_BACKOFF_BASE_DELAY = 1000 // 1 second

/**
 * Internal functions
 * TODO: write tests for these
 */

export const _batchDelete = async (
  rows: { tableId: string; rowId: string }[],
  attempts = 0,
): Promise<void> => {
  const res = await TableRow.delete(rows).go({
    ignoreOwnership: true,
  })
  if (res.unprocessed.length) {
    if (attempts >= MAX_RETRIES) {
      logger.error(res.unprocessed)
      throw new Error('Max retries exceeded for batchDelete')
    }
    const delay = Math.pow(2, attempts) * EXPONENTIAL_BACKOFF_BASE_DELAY
    attempts++
    // eslint-disable-next-line no-console
    logger.warn(
      `Retrying batchDelete, attempt ${attempts} with ${res.unprocessed.length} unprocessed items}`,
    )
    await new Promise((resolve) => setTimeout(resolve, delay))
    return _batchDelete(res.unprocessed, attempts)
  }
  return
}

export const _batchCreate = async (
  rows: TableRowItem[],
  attempts = 0,
): Promise<void> => {
  const res = await TableRow.put(rows).go({
    ignoreOwnership: true,
    preserveBatchOrder: true,
  })
  if (res.unprocessed.length) {
    if (attempts >= MAX_RETRIES) {
      logger.error(res.unprocessed)
      throw new Error('Max retries exceeded for batchCreate')
    }
    const delay = Math.pow(2, attempts) * EXPONENTIAL_BACKOFF_BASE_DELAY
    attempts++
    // eslint-disable-next-line no-console
    logger.warn(
      `Retrying batchCreate, attempt ${attempts} with ${res.unprocessed.length} unprocessed items}`,
    )
    await new Promise((resolve) => setTimeout(resolve, delay))
    return _batchCreate(res.unprocessed as TableRowItem[], attempts)
  }
  return
}

const generateProjectionExpressions = ({
  columnIds = [],
  filters = [],
  indexUsed = 'createdAtIndex',
  includeTimestamps = false,
}: {
  columnIds?: string[]
  filters?: TableRowFilter[]
  indexUsed?: TableRowIndexName | 'byRowId'
  includeTimestamps?: boolean
}): {
  ProjectionExpression: string
  ExpressionAttributeNames: Record<string, string>
} => {
  const ProjectionExpression = [
    'rowId',
    ...columnIds.map((_id, i) => `#data.#col${i}`),
    ...(indexUsed === 'gsiString1' ? ['skString1'] : []),
    ...(includeTimestamps ? ['createdAt', 'updatedAt'] : []),
  ].join(',')
  // #pk has to be mapped since it's used by electrodb
  // #data has to be mapped since it's a reserved word
  const ExpressionAttributeNames: Record<string, string> = {
    '#pk': 'tableId',
    // we only need to map #data if we're projecting nested attributes or filters
    ...(columnIds.length || filters?.length ? { '#data': 'data' } : {}),
  }
  if (indexUsed === 'byRowId') {
    ExpressionAttributeNames['#sk1'] = 'rowId'
  }
  if (indexUsed === 'gsiString1') {
    ExpressionAttributeNames['#sk1'] = 'skString1'
  }
  // Add attribute name mapping for column name projection
  columnIds.forEach((id: string, i: number) => {
    ExpressionAttributeNames[`#col${i}`] = id
  })
  // Add attribute name mapping for filter expression
  filters.forEach((filter) => {
    ExpressionAttributeNames[`#${filter.columnId.replaceAll('-', '')}`] =
      filter.columnId
  })
  return { ProjectionExpression, ExpressionAttributeNames }
}

const addGsiSortKeyToQuery = (
  query: ReturnType<typeof TableRow.query.byGsiString1>,
  filter: TableRowFilter,
) => {
  const { columnId, operator, value } = filter
  switch (operator) {
    case TableRowFilterOperator.BeginsWith:
      query.begins({ [columnId]: value })
      return
    case TableRowFilterOperator.GreaterThan:
      query.gt({ [columnId]: value })
      return
    case TableRowFilterOperator.GreaterThanOrEquals:
      query.gte({ [columnId]: value })
      return
    case TableRowFilterOperator.LessThan:
      query.lt({ [columnId]: value })
      return
    case TableRowFilterOperator.LessThanOrEquals:
      query.lte({ [columnId]: value })
      return
    case TableRowFilterOperator.IsEmpty:
      query.where((row, { notExists }) =>
        notExists(row[columnId as keyof typeof row]),
      )
      break
    // equals is handled outside of this function
    case TableRowFilterOperator.Equals:
      return
  }
}

const addFiltersToQuery = (
  query: ReturnType<typeof TableRow.query.byCreatedAt>,
  filters: TableRowFilter[],
): void => {
  if (filters?.length) {
    query.where(
      ({ data }, { eq, begins, contains, gt, gte, lt, lte, notExists }) => {
        const whereExpressions: string[] = []
        for (const filter of filters) {
          const { columnId, operator, value } = filter
          const marshalledValue = autoMarshallNumberStrings(value)
          switch (operator) {
            case TableRowFilterOperator.Equals:
              whereExpressions.push(eq(data[columnId], marshalledValue))
              break
            case TableRowFilterOperator.BeginsWith:
              whereExpressions.push(begins(data[columnId], value))
              break
            case TableRowFilterOperator.Contains:
              whereExpressions.push(contains(data[columnId], value))
              break
            case TableRowFilterOperator.GreaterThan:
              whereExpressions.push(gt(data[columnId], marshalledValue))
              break
            case TableRowFilterOperator.GreaterThanOrEquals:
              whereExpressions.push(gte(data[columnId], marshalledValue))
              break
            case TableRowFilterOperator.LessThan:
              whereExpressions.push(lt(data[columnId], marshalledValue))
              break
            case TableRowFilterOperator.LessThanOrEquals:
              whereExpressions.push(lte(data[columnId], marshalledValue))
              break
            case TableRowFilterOperator.IsEmpty:
              whereExpressions.push(
                `(${eq(data[columnId], '')} OR ${notExists(data[columnId])})`,
              )
              break
          }
        }
        return whereExpressions.join(' AND ')
      },
    )
  }
}

export const createTableRow = async ({
  tableId,
  data,
}: CreateRowInput): Promise<TableRowItem> => {
  try {
    const res = await TableRow.create({
      tableId,
      rowId: randomUUID(),
      data,
    }).go({ ignoreOwnership: true })
    return res.data
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}

export const createTableRows = async ({
  tableId,
  dataArray,
  gsi,
}: CreateRowsInput): Promise<string[]> => {
  try {
    const rows = dataArray.map((data, i) => {
      return {
        tableId,
        rowId: randomUUID(),
        data,
        // manually bumping the createdAt timestamp to ensure that row order is preserved
        createdAt: Date.now() + i,
        ...(gsi ? getSkKeyValue(gsi.indexName, data[gsi.columnIdToMap]) : {}),
      }
    })
    await _batchCreate(rows)
    return rows.map((row) => row.rowId)
  } catch (e: unknown) {
    handleDynamoDBError(e)
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
    await TableRow.patch({
      tableId,
      rowId,
    })
      .set({
        data,
      })
      .go({
        ignoreOwnership: true,
      })
  } catch (e: unknown) {
    handleDynamoDBError(e)
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
    const patchOperation = TableRow.patch({
      tableId,
      rowId,
    }).data(({ data }, { set, add, subtract }) => {
      // Handle set operations
      Object.entries(patchData.set || {}).forEach(
        ([key, value]: [string, string]) => {
          set(data[key], value ? autoMarshallNumberStrings(value) : '')
        },
      )

      // Handle add operations
      Object.entries(patchData.add || {}).forEach(
        ([key, value]: [string, string]) => {
          add(data[key], autoMarshallNumberStrings(value))
        },
      )

      // Handle subtract operations
      Object.entries(patchData.subtract || {}).forEach(
        ([key, value]: [string, string]) => {
          subtract(data[key], autoMarshallNumberStrings(value))
        },
      )
    })

    const res = await patchOperation.go({
      ignoreOwnership: true,
      response: 'all_new',
    })

    return res.data
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}

export const deleteTableRows = async ({
  rowIds,
  tableId,
}: DeleteRowsInput): Promise<void> => {
  try {
    const batch = []
    for (const rowId of rowIds) {
      batch.push({
        tableId,
        rowId,
      })
    }
    await _batchDelete(batch)
    return
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}

export const getTableRowCount = async ({
  tableId,
}: {
  tableId: string
}): Promise<number> => {
  try {
    const res = await TableRow.query.byRowId({ tableId }).go({
      pages: 'all',
      attributes: ['rowId'],
      ignoreOwnership: true,
    })
    return res.data.length
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}

export const getTableRows = async ({
  tableId,
  columnIds,
  filters,
  order = 'asc',
  stringifiedCursor,
  scanLimit,
  gsi,
}: {
  tableId: string
  columnIds?: string[]
  filters?: TableRowFilter[]
  order?: 'asc' | 'desc'
  /**
   * if stringifiedCursor is 'start', we will fetch the first page of results
   * if undefined, we will auto-paginate
   */
  stringifiedCursor?: string | 'start'
  /**
   * Optional limit on the total number of rows scanned.
   */
  scanLimit?: number
  gsi?: {
    indexName: TableRowIndexName
    filter: TableRowFilter
  }
}): Promise<{
  rows: TableRowOutput[]
  stringifiedCursor?: string
}> => {
  if (stringifiedCursor && scanLimit) {
    throw new Error('stringifiedCursor and scanLimit cannot both be provided')
  }
  // need to use ProjectionExpression to select nested attributes

  const { ProjectionExpression, ExpressionAttributeNames } =
    generateProjectionExpressions({
      columnIds,
      filters,
      // if we're using a GSI, we need to include the timestamps to sort later on
      includeTimestamps: !!gsi,
      indexUsed: gsi?.indexName ?? 'createdAtIndex',
    })
  console.log({ ProjectionExpression, ExpressionAttributeNames })
  const tableRows = []

  let remainingScanLimit = scanLimit ?? Infinity
  let cursor: any =
    stringifiedCursor && stringifiedCursor !== 'start'
      ? JSON.parse(stringifiedCursor)
      : null

  let query
  switch (gsi?.indexName) {
    case 'gsiString1':
      query = TableRow.query.byGsiString1({
        tableId,
        ...(gsi.filter.operator === TableRowFilterOperator.Equals
          ? { skString1: gsi.filter.value }
          : {}),
      })
      addGsiSortKeyToQuery(query, gsi.filter)
      break
    case 'createdAtIndex':
    default:
      query = TableRow.query.byCreatedAt({ tableId })
      break
  }
  if (filters?.length) {
    addFiltersToQuery(query, filters)
  }
  try {
    do {
      const response = await query.go({
        order,
        pages: 'all', // this is ignored, we need to paginate manually
        cursor,
        params: {
          ProjectionExpression,
          ExpressionAttributeNames,
          Limit: remainingScanLimit,
        },
        // use data:'raw' to bypass electrodb formatting, since we're using ProjectionExpression to select nested attributes
        // ref: https://electrodb.dev/en/queries/get/#execution-options
        data: 'raw',
        pager: 'raw',
        ignoreOwnership: true,
      })

      // need to explicitly cast to DynamoDB's raw output because of the 'raw' option
      const data = response.data as unknown as QueryCommandOutput & {
        Items: TableRowOutput[]
      }
      tableRows.push(...data.Items)
      remainingScanLimit -= data.ScannedCount
      cursor = data.LastEvaluatedKey
      // loop only if cursor is
    } while (cursor && !stringifiedCursor && remainingScanLimit > 0)

    /**
     * When using GSI's we do the sorting ourselves
     */
    const sortedRows = gsi
      ? tableRows.sort((a, b) => {
          return order === 'asc'
            ? // we sort by earliest createdAt first
              a.createdAt - b.createdAt
            : // we sort by latest createdAt first
              b.createdAt - a.createdAt
        })
      : tableRows

    return {
      rows: sortedRows.map((row) => ({
        ...row,
        data: row.data || {}, // data can be undefined if values are empty
      })),
      stringifiedCursor:
        cursor && stringifiedCursor ? JSON.stringify(cursor) : undefined,
      // if no cursor was passed in, we should not return
    }
  } catch (e: unknown) {
    handleDynamoDBError(e)
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
    const { ProjectionExpression, ExpressionAttributeNames } =
      generateProjectionExpressions({ columnIds, indexUsed: 'byRowId' })
    const response = await TableRow.query.byRowId({ tableId, rowId }).go({
      ignoreOwnership: true,
      params: {
        ProjectionExpression,
        ExpressionAttributeNames,
      },
      data: 'raw',
    })

    const { Items } = response.data as unknown as QueryCommandOutput & {
      Items: TableRowOutput[]
    }
    if (!Items?.length) {
      return null
    }
    return Items[0]
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}
