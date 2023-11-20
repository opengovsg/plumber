import { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { Cell, RowData } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    activeCell: CellType | null
    setActiveCell: (newCell: CellType | null) => void
    rowsUpdating: Record<string, boolean>
    rowsCreated: Set<string>
    tempRowData: MutableRefObject<GenericRowData | null>
    addNewRow: () => void
    removeRows: (rowIds: string[]) => void
    isAddingNewRow: boolean
    focusOnNewRow: () => void
    setEditingRowIndex: Dispatch<SetStateAction<number | null>>
  }
}

export interface GenericRowData extends Record<string, string> {
  rowId: string
}

export type CellType = Cell<GenericRowData, string>
