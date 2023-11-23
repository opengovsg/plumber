import { Fragment, useMemo } from 'react'
import { flexRender, Row, TableMeta } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'

import { ROW_HEIGHT, TEMP_ROW_ID_PREFIX, Z_INDEX } from '../../constants'
import { RowContextProvider } from '../../contexts/RowContext'
import { GenericRowData } from '../../types'

import styles from './TableCell.module.css'

interface TableRowProps {
  row: Row<GenericRowData>
  tableMeta: TableMeta<GenericRowData>
  virtualRow?: VirtualItem
  stickyBottom?: boolean
}

export default function TableRow({
  row,
  stickyBottom,
  tableMeta,
  virtualRow,
}: TableRowProps) {
  const className = useMemo(() => {
    const isSavingRow = tableMeta.rowsUpdating[row.id]
    const isSavedRow = tableMeta.rowsCreated.has(row.id)
    if (isSavingRow === true) {
      return styles.saving
    }
    if (isSavingRow === false) {
      return styles.saved
    }
    if (row.id.startsWith(TEMP_ROW_ID_PREFIX)) {
      return styles.saving
    }
    if (isSavedRow) {
      return styles.saved
    }
    return undefined
  }, [row.id, tableMeta.rowsCreated, tableMeta.rowsUpdating])

  const isHighlightingRow = useMemo(
    () => tableMeta.highlightedCell?.row.id === row.id,
    [tableMeta.highlightedCell?.row.id, row.id],
  )

  const backgroundColor = useMemo(
    () =>
      (virtualRow?.index ?? 0) % 2
        ? 'var(--chakra-colors-primary-50)'
        : 'white',
    [virtualRow?.index],
  )

  const isEditingRow = tableMeta.activeCell?.row.id === row.id

  return (
    <RowContextProvider
      sortedIndex={virtualRow?.index}
      className={className}
      isHighlightingRow={isHighlightingRow}
      isEditingRow={isEditingRow}
      backgroundColor={backgroundColor}
    >
      <div
        style={
          stickyBottom
            ? {
                width: 'fit-content',
                minWidth: '100%',
                position: 'sticky',
                bottom: ROW_HEIGHT.FOOTER,
                display: 'flex',
                alignItems: 'stretch',
                height: isEditingRow ? ROW_HEIGHT.EXPANDED : ROW_HEIGHT.DEFAULT,
                flexShrink: 0,
                backgroundColor: 'white',
                zIndex: Z_INDEX.NEW_ROW,
                borderTop: '1px solid var(--chakra-colors-primary-800)',
              }
            : {
                position: 'absolute',
                transform: `translateY(${virtualRow?.start}px)`,
                display: 'flex',
                alignItems: 'stretch',
                zIndex: isEditingRow
                  ? Z_INDEX.ACTIVE_ROW
                  : Z_INDEX.INACTIVE_ROW,
                backgroundColor,
                height: ROW_HEIGHT.DEFAULT,
              }
        }
      >
        {row.getVisibleCells().map((cell) => (
          <Fragment key={cell.column.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </Fragment>
        ))}
      </div>
    </RowContextProvider>
  )
}
