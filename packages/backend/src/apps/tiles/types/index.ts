import { IJSONObject } from '@plumber/types'

import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'
import { TableRowOutput } from '@/models/tiles/types'

export interface FindSingleRowOutput {
  rowsFound: number
  rowId?: string
  row?: Record<string, string | number>
}

export type TileColumnMetadata = {
  id: string
  name: string
  value: string
}

export interface FindMultipleRowsOutput {
  rowsFound: number
  data?: {
    rows: TableRowOutput[]
    columns: TileColumnMetadata[]
    inputSource: FOR_EACH_INPUT_SOURCE.TILES
  }
}

export interface CreateRowOutput extends IJSONObject {
  rowId: string
  row: Record<string, string | number>
}

export interface UpdateRowOutput {
  rowId?: string
  row?: Record<string, string | number>
  updated: boolean
}
