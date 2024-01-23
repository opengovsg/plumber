import { Row, Table } from '@tanstack/react-table'

import { CellType, GenericRowData } from '../types'

export function moveCell({
  table,
  row,
  rowIndex,
  columnIndex,
  direction,
  allowCrossBoundaries = false,
}: {
  table: Table<GenericRowData>
  row: Row<GenericRowData>
  rowIndex: number
  columnIndex: number
  direction: 'up' | 'down' | 'left' | 'right'
  allowCrossBoundaries?: boolean
}) {
  const columnIds = table.getState().columnOrder
  const rowModel = table.getRowModel()
  const tableMeta = table.options.meta
  switch (direction) {
    case 'up': {
      const prevRowIndex = allowCrossBoundaries
        ? rowIndex - 1
        : Math.max(rowIndex - 1, 0)
      const prevRow = rowModel.rows[prevRowIndex]
      const nextActiveCell = prevRow
        ? (prevRow.getVisibleCells()[columnIndex] as CellType)
        : null
      tableMeta?.setActiveCell(nextActiveCell)
      return
    }
    case 'down': {
      const nextRowIndex = allowCrossBoundaries
        ? rowIndex + 1
        : Math.min(rowIndex + 1, rowModel.rows.length - 1)
      const nextRow = rowModel.rows[nextRowIndex]
      const nextActiveCell = nextRow
        ? (nextRow.getVisibleCells()[columnIndex] as CellType)
        : null
      tableMeta?.setActiveCell(nextActiveCell)
      return
    }
    case 'left': {
      const nextActiveCell = row.getVisibleCells()[
        Math.max(columnIndex - 1, 1)
      ] as CellType
      tableMeta?.setActiveCell(nextActiveCell)
      break
    }
    case 'right': {
      const nextActiveCell = row.getVisibleCells()[
        Math.min(columnIndex + 1, columnIds.length - 2)
      ] as CellType
      tableMeta?.setActiveCell(nextActiveCell)
      break
    }
    default:
      return
  }
}
