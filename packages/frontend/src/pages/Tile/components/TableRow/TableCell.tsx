import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  memo,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { Textarea } from '@chakra-ui/react'
import { CellContext, Row, TableMeta } from '@tanstack/react-table'

import {
  DELAY,
  NEW_ROW_ID,
  ROW_HEIGHT,
  TEMP_ROW_ID_PREFIX,
  Z_INDEX_CELL,
} from '../../constants'
import { useRowContext } from '../../contexts/RowContext'
import { shallowCompare } from '../../helpers/shallow-compare'
import { CellType, GenericRowData } from '../../types'

import styles from './TableCell.module.css'

function TableCell({
  getValue,
  row,
  column,
  table,
  cell,
}: CellContext<GenericRowData, string>) {
  const { sortedIndex } = useRowContext()
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const tableMeta = table.options.meta as TableMeta<GenericRowData>
  const isEditingCell = tableMeta?.activeCell?.id === cell.id
  const editingRowId = tableMeta?.activeCell?.row.id
  const isEditingRow = row.id === editingRowId
  const columnIds = table.getState().columnOrder
  const columnIndex = columnIds.indexOf(column.id)

  const value = isEditingRow
    ? tableMeta.tempRowData.current?.[column.id]
    : getValue()

  const startEditing = useCallback(
    (
      e:
        | FocusEvent<HTMLInputElement | HTMLTextAreaElement>
        | MouseEvent<HTMLDivElement>,
    ) => {
      tableMeta?.setActiveCell(cell)
      if (e.target instanceof HTMLTextAreaElement) {
        e.target.select()
      }
    },
    [cell, tableMeta],
  )

  const focusOnFirstCell = useCallback(
    (row: Row<GenericRowData>) => {
      setTimeout(() => {
        try {
          const newRowCell = row.getVisibleCells()[1] as CellType | null
          tableMeta?.setActiveCell(newRowCell)
        } catch (_) {
          // no newRow found, do nothing
        }
      }, DELAY.FOCUS_CELL)
    },
    [tableMeta],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()

        if (row.id === NEW_ROW_ID || sortedIndex === -1) {
          if (
            !shallowCompare(tableMeta?.tempRowData.current, {
              rowId: NEW_ROW_ID,
            })
          ) {
            tableMeta?.setActiveCell(null)
            focusOnFirstCell(row)
          }
          return
        }
        const nextRow = table.getSortedRowModel().rows[sortedIndex + 1]
        const nextActiveCell = nextRow
          ? (nextRow.getVisibleCells()[columnIndex] as CellType)
          : null
        tableMeta?.setActiveCell(nextActiveCell)
      }
      // on tab
      if (e.key === 'Tab') {
        e.preventDefault()
        const increment = e.shiftKey ? -1 : 1
        const nextColumnIndex = Math.min(
          Math.max(1, columnIndex + increment),
          columnIds.length - 2, // -2 to account for select and new columns
        )
        const nextActiveCell = row.getVisibleCells()[
          nextColumnIndex
        ] as CellType
        tableMeta?.setActiveCell(nextActiveCell)
      }

      if (e.key === 'Escape') {
        tableMeta?.setActiveCell(null)
      }
    },
    [
      row,
      sortedIndex,
      table,
      columnIndex,
      tableMeta,
      focusOnFirstCell,
      columnIds.length,
    ],
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (tableMeta?.tempRowData.current) {
        tableMeta.tempRowData.current[column.id] = e.target.value
      }
    },
    [column.id, tableMeta],
  )

  useEffect(() => {
    if (isEditingCell) {
      textAreaRef.current?.focus()
    }
  }, [isEditingCell])

  const className = useMemo(() => {
    const isSavingRow = tableMeta?.rowsUpdating[row.id]
    const isSavedRow = tableMeta?.rowsCreated.has(row.id)
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
  }, [row.id, tableMeta?.rowsCreated, tableMeta?.rowsUpdating])

  return (
    <div
      style={{
        height: '100%',
        width: `${column.getSize()}px`,
        flexShrink: 0,
        cursor: 'default',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--chakra:-colors-primary-100)',
        borderTopWidth: 0,
        borderLeftWidth: 0,
        zIndex: isEditingCell ? Z_INDEX_CELL.ACTIVE_CELL : Z_INDEX_CELL.DEFAULT,
      }}
      className={!isEditingCell ? styles.cell : undefined}
      onClick={startEditing}
    >
      {isEditingCell ||
      (row.id === NEW_ROW_ID && editingRowId === NEW_ROW_ID) ? (
        <Textarea
          ref={textAreaRef}
          fontSize="0.875rem"
          h={ROW_HEIGHT.EXPANDED}
          background="white"
          outline="none"
          border="none"
          defaultValue={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          borderRadius={0}
          resize="none"
          onFocus={startEditing}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            alignItems: 'center',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            wordBreak: 'break-word',
            fontSize: '0.875rem',
          }}
          className={className}
        >
          <p
            style={{
              maxHeight: '100%',
              overflow: 'hidden',
              // no wrap
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {value}
          </p>
        </div>
      )}
    </div>
  )
}

export default memo(TableCell)
