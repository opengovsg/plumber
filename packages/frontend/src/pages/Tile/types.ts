import { MutableRefObject } from 'react'
import { Cell, RowData } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    activeCell: CellType | null
    setActiveCell: (newCell: CellType | null) => void
    rowsUpdating: Record<string, boolean>
    tempRowData: MutableRefObject<GenericRowData | null>
  }
}

export interface GenericRowData extends Record<string, string> {
  rowId: string
}

export type CellType = Cell<GenericRowData, string>
