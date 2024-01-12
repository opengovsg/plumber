import { IJSONObject } from '@plumber/types'

export interface FindSingleRowOutput extends IJSONObject {
  rowsFound: number
  rowId?: string
  row?: Record<string, string | number>
}

export interface CreateRowOutput extends IJSONObject {
  rowId: string
  row: Record<string, string | number>
}
