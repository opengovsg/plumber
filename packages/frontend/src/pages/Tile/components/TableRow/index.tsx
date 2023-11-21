import { Fragment } from 'react'
import { flexRender, Row } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'

import { ROW_HEIGHT, Z_INDEX } from '../../constants'
import { RowContextProvider } from '../../contexts/RowContext'
import { GenericRowData } from '../../types'

interface TableRowProps {
  row: Row<GenericRowData>
  isEditing: boolean
  virtualRow?: VirtualItem
  stickyBottom?: boolean
}

export default function TableRow({
  row,
  stickyBottom,
  isEditing,
  virtualRow,
}: TableRowProps) {
  return (
    <RowContextProvider sortedIndex={virtualRow?.index}>
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
                height: isEditing ? ROW_HEIGHT.EXPANDED : ROW_HEIGHT.DEFAULT,
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
                zIndex: isEditing ? Z_INDEX.ACTIVE_ROW : Z_INDEX.INACTIVE_ROW,
                backgroundColor:
                  (virtualRow?.index ?? 0) % 2
                    ? 'var(--chakra-colors-primary-50)'
                    : 'white',
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
