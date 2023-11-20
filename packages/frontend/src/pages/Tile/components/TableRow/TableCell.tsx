import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { Textarea } from '@chakra-ui/react'
import { CellContext } from '@tanstack/react-table'

import { NEW_ROW_ID, ROW_HEIGHT, TEMP_ROW_ID_PREFIX } from '../../constants'
import { useRowContext } from '../../contexts/RowContext'
import { shallowCompare } from '../../helpers/shallow-compare'
import { CellType, GenericRowData } from '../../types'

import styles from './TableCell.module.css'

export default function TableCell({
  getValue,
  row,
  column,
  table,
  cell,
}: CellContext<GenericRowData, string>) {
  const { sortedIndex } = useRowContext()
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const tableMeta = table.options.meta
  const isEditingRow = tableMeta?.activeCell?.row.id === row.id
  const isEditingCell = tableMeta?.activeCell?.id === cell.id

  const originalValue = getValue()
  const columnIds = table.getAllLeafColumns().map((c) => c.id)

  const startEditing = useCallback(
    (
      e:
        | FocusEvent<HTMLInputElement | HTMLTextAreaElement>
        | MouseEvent<HTMLDivElement>,
    ) => {
      tableMeta?.setActiveCell(cell)
      tableMeta?.setEditingRowIndex(sortedIndex)
      if (e.target instanceof HTMLTextAreaElement) {
        e.target.select()
      }
    },
    [cell, sortedIndex, tableMeta],
  )

  const getCell = useCallback(
    (rowId: string, columnId: string) => {
      const row = table.getRow(rowId)
      const rowCells = row.getVisibleCells()
      return (
        (rowCells.find((cell) => cell.column.id === columnId) as CellType) ??
        null
      )
    },
    [table],
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
            tableMeta?.focusOnNewRow()
          }
          return
        }
        const nextRowId = table.getSortedRowModel().rows[sortedIndex + 1]?.id
        const nextActiveCell = nextRowId ? getCell(nextRowId, column.id) : null
        tableMeta?.setActiveCell(nextActiveCell)
        tableMeta?.setEditingRowIndex(sortedIndex + 1)
      }
      // on tab
      if (e.key === 'Tab') {
        e.preventDefault()
        const columnIndex = columnIds.indexOf(column.id)
        const increment = e.shiftKey ? -1 : 1
        const nextColumnIndex = Math.min(
          Math.max(0, columnIndex + increment),
          columnIds.length - 1,
        )
        const nextColumnId = columnIds[nextColumnIndex]
        const nextActiveCell = getCell(row.id, nextColumnId)
        tableMeta?.setActiveCell(nextActiveCell)
        tableMeta?.setEditingRowIndex(sortedIndex)
      }

      if (e.key === 'Escape') {
        tableMeta?.setActiveCell(null)
        tableMeta?.setEditingRowIndex(null)
      }
    },
    [row.id, sortedIndex, table, getCell, column.id, tableMeta, columnIds],
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
        height: isEditingRow ? ROW_HEIGHT.EXPANDED : ROW_HEIGHT.DEFAULT,
        minHeight: ROW_HEIGHT.DEFAULT,
        width: '100%',
        cursor: 'default',
        borderWidth: '0.5px',
        borderStyle: 'solid',
        borderColor: isEditingCell
          ? 'var(--chakra-colors-primary-600)'
          : 'var(--chakra-colors-primary-100)',
      }}
      className={!isEditingCell ? styles.cell : undefined}
      onClick={startEditing}
    >
      {isEditingRow ? (
        <Textarea
          ref={textAreaRef}
          background="transparent"
          onFocus={startEditing}
          outline="none"
          zIndex={isEditingCell ? 1 : 0}
          defaultValue={originalValue}
          onChange={onChange}
          h="100%"
          _focusWithin={{
            boxShadow: 'none',
            bgColor: 'primary.100',
          }}
          rows={5}
          resize="none"
          onKeyDown={onKeyDown}
          borderRadius={0}
          borderWidth={0}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            minWidth: '100%',
            maxWidth: 0,
            alignItems: 'center',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            wordBreak: 'break-word',
            overflow: 'hidden',
          }}
          className={className}
        >
          <p
            style={{
              maxHeight: '100%',
            }}
          >
            {originalValue}
          </p>
        </div>
      )}
    </div>
  )
}
