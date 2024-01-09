import { CreateEntityItem } from 'electrodb'

import { TableRow } from './model'

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
