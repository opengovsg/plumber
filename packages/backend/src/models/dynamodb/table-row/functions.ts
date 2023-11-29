import { randomUUID } from 'crypto'
import { CreateEntityItem } from 'electrodb'

import { handleDynamoDBError } from '../helpers'

import { TableRow } from './model'

const MAX_RETRIES = 8
const EXPONENTIAL_BACKOFF_BASE_DELAY = 1000 // 1 second

export type TableRowItem = CreateEntityItem<typeof TableRow>
export type CreateRowInput = Pick<TableRowItem, 'tableId' | 'data'>
export type UpdateRowInput = Pick<TableRowItem, 'tableId' | 'data' | 'rowId'>
export interface DeleteRowsInput {
  tableId: string
  rowIds: string[]
}

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
}: {
  tableId: string
  dataArray: Record<string, string>[]
}): Promise<string[]> => {
  try {
    const rows = dataArray.map((data) => ({
      tableId,
      rowId: randomUUID(),
      data,
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
}: {
  tableId: string
}): Promise<
  {
    rowId: string
    data: any
  }[]
> => {
  try {
    const { data } = await TableRow.query.byCreatedAt({ tableId }).go({
      order: 'asc',
      pages: 'all',
      attributes: ['rowId', 'data'],
      ignoreOwnership: true,
    })
    return data
  } catch (e: unknown) {
    handleDynamoDBError(e)
  }
}
