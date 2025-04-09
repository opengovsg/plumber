import { CreateEntityItem } from 'electrodb'

import { TableRow } from './model'

export const GSIS = [
  {
    gsi: 'gsiString1',
    sk: 'skString1',
    type: 'string',
  },
] as const
export type TableRowIndexName = (typeof GSIS)[number]['gsi'] | 'createdAtIndex'
export type TableRowSortKeyName = (typeof GSIS)[number]['sk']

export type GsiOptions = {
  indexName: TableRowIndexName
  columnIdToMap: string
}

export type TableRowItem = CreateEntityItem<typeof TableRow>
export type CreateRowInput = Pick<TableRowItem, 'tableId' | 'data'> & {
  gsis?: GsiOptions[]
}
export type CreateRowsInput = {
  tableId: string
  dataArray: Array<TableRowItem['data']>
  gsis?: GsiOptions[]
}
export type UpdateRowInput = Pick<
  TableRowItem,
  'tableId' | 'rowId' | 'data'
> & {
  gsis?: GsiOptions[]
}

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
export type TableRowOutput = Pick<
  TableRowItem,
  'rowId' | 'data' | 'createdAt' | 'updatedAt'
>

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
