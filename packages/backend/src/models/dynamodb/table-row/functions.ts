import { type QueryCommandOutput } from '@aws-sdk/client-dynamodb'
import { randomUUID } from 'crypto'
import { type CreateEntityItem } from 'electrodb'

import { handleDynamoDBError } from '../helpers'

import { TableRow } from './model'

const MAX_RETRIES = 8
const EXPONENTIAL_BACKOFF_BASE_DELAY = 1000 // 1 second

export type TableRowItem = CreateEntityItem<typeof TableRow>
export type CreateRowInput = Pick<TableRowItem, 'tableId' | 'data'>
export type CreateRowsInput = {
  tableId: string
  dataArray: Record<string, string>[]
}
export type UpdateRowInput = Pick<TableRowItem, 'tableId' | 'data' | 'rowId'>
export interface DeleteRowsInput {
  tableId: string
  rowIds: string[]
}
export type TableRowOutput = Pick<TableRowItem, 'rowId' | 'data'>

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

export const getAllTableRows = async ({
  tableId,
  columnIds,
}: {
  tableId: string
  columnIds?: string[]
}): Promise<TableRowOutput[]> => {
  try {
    // need to use ProjectionExpression to select nested attributes
    const ProjectionExpression = [
      'rowId',
      ...(columnIds ? columnIds.map((_id, i) => `#data.#col${i}`) : ['#data']),
    ].join(',')
    // need to use ExpressionAttributeNames to since data is a reserved keyword and attribute names with
    // special characters (e.g. '-') need to be escaped
    const ExpressionAttributeNames = columnIds
      ? columnIds.reduce(
          (acc, id, i) => ({
            ...acc,
            [`#col${i}`]: id,
          }),
          { '#data': 'data', '#pk': 'tableId' },
        )
      : undefined
    const tableRows = []
    let cursor: any = null
    do {
      const response = await TableRow.query.byCreatedAt({ tableId }).go({
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
      })
      // need to explicitly cast to DynamoDB's raw output because of the 'raw' option
      const data = response.data as unknown as QueryCommandOutput & {
        Items: TableRowOutput[]
      }
      tableRows.push(...data.Items)
      cursor = data.LastEvaluatedKey
    } while (cursor)
    return tableRows
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}
