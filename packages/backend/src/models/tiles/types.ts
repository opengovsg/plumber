import { CreateEntityItem } from 'electrodb'

import { TableRow } from './dynamodb/table-row/model'

export type TableRowItem = CreateEntityItem<typeof TableRow>
export type CreateRowInput = Pick<TableRowItem, 'tableId' | 'data'>
export type CreateRowsInput = {
  tableId: string
  dataArray: Array<TableRowItem['data']>
}
export type UpdateRowInput = Pick<TableRowItem, 'tableId' | 'rowId' | 'data'>

export type PatchRowInput = Pick<TableRowItem, 'tableId' | 'rowId'> & {
  patchData: {
    set?: TableRowItem['data']
    add?: TableRowItem['data']
    subtract?: TableRowItem['data']
  }
}
export interface DeleteRowsInput {
  tableId: string
  rowIds: string[]
}
export type TableRowOutput = Pick<TableRowItem, 'rowId' | 'data'>
export type TableRowOutputWithTimestamps = TableRowOutput & {
  createdAt: number
  updatedAt: number
}

export enum TableRowFilterOperator {
  Equals = 'equals',
  GreaterThan = 'gt',
  GreaterThanOrEquals = 'gte',
  LessThan = 'lt',
  LessThanOrEquals = 'lte',
  BeginsWith = 'begins',
  Contains = 'contains',
  IsEmpty = 'empty',
}

export type TableRowFilter = {
  columnId: string
  operator: TableRowFilterOperator
  value?: string
}

export type DatabaseType = 'pg' | 'ddb'

export interface TableOperations {
  createTableRow(input: CreateRowInput): Promise<TableRowItem>
  createTableRows(input: CreateRowsInput): Promise<string[]>
  updateTableRow(input: UpdateRowInput): Promise<void>
  patchTableRow(input: PatchRowInput): Promise<TableRowItem>
  deleteTableRows(input: DeleteRowsInput): Promise<void>
  getTableRowCount({ tableId }: { tableId: string }): Promise<number>
  getTableRows(params: {
    tableId: string
    columnIds?: string[]
    filters?: TableRowFilter[]
    order?: 'asc' | 'desc'
    stringifiedCursor?: string | 'start'
    scanLimit?: number
  }): Promise<{
    rows: TableRowOutput[]
    stringifiedCursor?: string
  }>
  getRawRowById(params: {
    tableId: string
    rowId: string
    columnIds?: string[]
    includeTimestamps?: boolean
  }): Promise<TableRowOutput | TableRowOutputWithTimestamps | null>

  createTable(tableId: string, columnIds: string[]): Promise<void>
  createTableColumns(tableId: string, columnIds: string[]): Promise<void>
  deleteTableColumns(tableId: string, columnIds: string[]): Promise<void>
}
