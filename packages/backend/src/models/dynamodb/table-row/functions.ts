import { type QueryCommandOutput } from '@aws-sdk/client-dynamodb'
import { randomUUID } from 'crypto'

import { autoMarshallNumberStrings, handleDynamoDBError } from '../helpers'

import { TableRow } from './model'
import {
  CreateRowInput,
  CreateRowsInput,
  DeleteRowsInput,
  TableRowFilter,
  TableRowFilterOperator,
  TableRowItem,
  TableRowOutput,
  UpdateRowInput,
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
      console.error(res.unprocessed)
      throw new Error('Max retries exceeded for batchDelete')
    }
    const delay = Math.pow(2, attempts) * EXPONENTIAL_BACKOFF_BASE_DELAY
    attempts++
    // eslint-disable-next-line no-console
    console.log(
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
      console.error(res.unprocessed)
      throw new Error('Max retries exceeded for batchCreate')
    }
    const delay = Math.pow(2, attempts) * EXPONENTIAL_BACKOFF_BASE_DELAY
    attempts++
    // eslint-disable-next-line no-console
    console.log(
      `Retrying batchCreate, attempt ${attempts} with ${res.unprocessed.length} unprocessed items}`,
    )
    await new Promise((resolve) => setTimeout(resolve, delay))
    return _batchCreate(res.unprocessed as TableRowItem[], attempts)
  }
  return
}

/**
 * External functions
 */

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
}: CreateRowsInput): Promise<string[]> => {
  try {
    const rows = dataArray.map((data, i) => ({
      tableId,
      rowId: randomUUID(),
      data,
      // manually bumping the createdAt timestamp to ensure that row order is preserved
      createdAt: Date.now() + i,
    }))
    await _batchCreate(rows)
    return rows.map((row) => row.rowId)
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}

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
}: {
  tableId: string
  columnIds?: string[]
  filters?: TableRowFilter[]
}): Promise<TableRowOutput[]> => {
  try {
    // need to use ProjectionExpression to select nested attributes
    const ProjectionExpression = [
      'rowId',
      ...(columnIds ? columnIds.map((_id, i) => `#data.#col${i}`) : ['#data']),
    ].join(',')
    // need to use ExpressionAttributeNames to since data is a reserved keyword and attribute names with
    // special characters (e.g. '-') need to be escaped
    const ExpressionAttributeNames: Record<string, string> = {
      '#data': 'data',
      '#pk': 'tableId',
    }
    if (columnIds) {
      columnIds.forEach((id: string, i: number) => {
        ExpressionAttributeNames[`#col${i}`] = id
      })
    }
    const tableRows = []
    let cursor: any = null
    do {
      const query = TableRow.query.byCreatedAt({ tableId })
      if (filters?.length) {
        query.where(
          ({ data }, { eq, begins, contains, gt, gte, lt, lte, notExists }) => {
            const whereExpressions: string[] = []
            for (const filter of filters) {
              const { columnId, operator, value } = filter
              ExpressionAttributeNames[`#${columnId.replaceAll('-', '')}`] =
                columnId
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
                    `(${eq(data[columnId], '')} OR ${notExists(
                      data[columnId],
                    )})`,
                  )
                  break
              }
            }
            return whereExpressions.join(' AND ')
          },
        )
      }

      const response = await query.go({
        order: 'asc',
        pages: 'all',
        cursor,
        params: {
          ProjectionExpression,
          ExpressionAttributeNames,
        },
        // use data:'raw' to bypass electrodb formatting, since we're using ProjectionExpression to select nested attributes
        // ref: https://electrodb.dev/en/queries/get/#execution-options
        data: 'raw',
        pager: 'raw',
        ignoreOwnership: true,
        logger: console.log,
      })
      // need to explicitly cast to DynamoDB's raw output because of the 'raw' option
      const data = response.data as unknown as QueryCommandOutput & {
        Items: TableRowOutput[]
      }
      tableRows.push(...data.Items)
      cursor = data.LastEvaluatedKey
    } while (cursor)
    return tableRows.map((row) => ({
      ...row,
      data: row.data || {}, // data can be undefined if values are empty
    }))
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}

/**
 * Column IDs are unmapped and includes delete columns
 */
export const getRawRowById = async ({
  tableId,
  rowId,
}: {
  tableId: string
  rowId: string
}): Promise<TableRowOutput | undefined> => {
  try {
    const res = await TableRow.query.byRowId({ tableId, rowId }).go({
      ignoreOwnership: true,
    })
    if (!res.data.length) {
      return undefined
    }

    const firstRow = res.data[0]
    return firstRow
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}
