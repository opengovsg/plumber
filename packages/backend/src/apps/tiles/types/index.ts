import { IJSONObject } from '@plumber/types'

import { TableRowOutput } from '@/models/dynamodb/table-row'

export interface FindSingleRowOutput extends IJSONObject {
  rowsFound: number
  rowId?: string
  row?: Record<string, string | number>
}

export interface FindMultipleRowsOutput extends IJSONObject {
  rowsFound: number
  columns?: Record<string, string>
  rows?: string | TableRowOutput[]
}

export interface CreateRowOutput extends IJSONObject {
  rowId: string
  row: Record<string, string | number>
}

export interface UpdateRowOutput extends IJSONObject {
  rowId?: string
  row?: Record<string, string | number>
  updated: boolean
}
