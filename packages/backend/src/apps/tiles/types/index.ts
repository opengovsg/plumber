import { IJSONObject } from '@plumber/types'

import { TableRowOutput } from '@/models/dynamodb/table-row'

export interface FindSingleRowOutput extends IJSONObject {
  rowsFound: number
  rowId?: string
  row?: Record<string, string | number>
}

export type TileColumnMetadata = {
  id: string
  name: string
  value: string
}

export interface FindMultipleRowsOutput extends IJSONObject {
  rowsFound: number
  data?: {
    rows: TableRowOutput[]
    columns: TileColumnMetadata[]
  }
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
