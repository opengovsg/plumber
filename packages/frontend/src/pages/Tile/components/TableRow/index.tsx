import { flexRender, Row } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'

import { ROW_HEIGHT } from '../../constants'
import { RowContextProvider } from '../../contexts/RowContext'
import { GenericRowData } from '../../types'

import styles from './TableRow.module.css'

interface TableRowProps {
  row: Row<GenericRowData>
  virtualRow?: VirtualItem
  stickyBottom?: boolean
}

export default function TableRow({
  row,
  stickyBottom,
  virtualRow,
}: TableRowProps) {
  return (
    <RowContextProvider sortedIndex={virtualRow?.index}>
      <div
        style={
          stickyBottom
            ? {
                width: '100%',
                position: 'sticky',
                bottom: ROW_HEIGHT.FOOTER,
                display: 'flex',
                alignItems: 'stretch',
                backgroundColor: 'white',
                borderTop: '1px solid var(--chakra-colors-primary-800)',
              }
            : {
                position: 'absolute',
                transform: `translateY(${virtualRow?.start}px)`,
                display: 'flex',
                alignItems: 'stretch',
              }
        }
        className={styles.row}
      >
        {row.getVisibleCells().map((cell) => (
          <div
            key={cell.column.id}
            style={{
              width: cell.column.getSize(),
              padding: 0,
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ))}
      </div>
    </RowContextProvider>
  )
}
