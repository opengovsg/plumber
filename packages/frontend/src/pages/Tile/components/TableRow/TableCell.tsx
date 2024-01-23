import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  memo,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { Textarea } from '@chakra-ui/react'
import { CellContext, Row, TableMeta } from '@tanstack/react-table'
import { useTableContext } from 'pages/Tile/contexts/TableContext'
import { moveCell } from 'pages/Tile/helpers/cell-navigation'

import {
  BORDER_COLOR,
  DELAY,
  NEW_ROW_ID,
  ROW_HEIGHT,
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
  const { mode } = useTableContext()
  const { sortedIndex: rowIndex, className, isEditingRow } = useRowContext()
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const cellContainerRef = useRef<HTMLDivElement>(null)
  const tableMeta = table.options.meta as TableMeta<GenericRowData>
  const isEditingCell = tableMeta?.activeCell?.id === cell.id
  const editingRowId = tableMeta?.activeCell?.row.id
  const columnIds = table.getState().columnOrder
  const columnIndex = columnIds.indexOf(column.id)
  const isViewMode = mode === 'view'

  const value = isEditingRow
    ? tableMeta.tempRowData.current?.[column.id]
    : getValue()
  const isHighlightingCell = tableMeta?.highlightedCell?.id === cell.id

  const startEditing = useCallback(
    (
      e:
        | FocusEvent<HTMLInputElement | HTMLTextAreaElement>
        | MouseEvent<HTMLDivElement>,
    ) => {
      tableMeta?.setActiveCell(cell)
      if (!isViewMode && e.target instanceof HTMLTextAreaElement) {
        e.target.select()
      }
    },
    [cell, isViewMode, tableMeta],
  )

  // When adding new rows, re-focus on the first cell
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
      /**
       * Keydown events for both readonly and edit mode
       */
      switch (e.key) {
        case 'Enter': {
          if (e.shiftKey) {
            return
          }
          e.preventDefault()
          if (!isViewMode) {
            if (row.id === NEW_ROW_ID || rowIndex === -1) {
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
          }
          moveCell({
            table,
            row,
            rowIndex,
            columnIndex,
            direction: 'down',
            allowCrossBoundaries: true,
          })
          break
        }
        // on tab
        case 'Tab': {
          e.preventDefault()
          moveCell({
            table,
            row,
            rowIndex,
            columnIndex,
            direction: e.shiftKey ? 'left' : 'right',
          })
          break
        }
        case 'Escape': {
          tableMeta.setActiveCell(null)
          break
        }
      }
      if (!isViewMode) {
        return
      }
      /**
       * The following keydown events are only for readonly mode
       */
      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          moveCell({
            table,
            row,
            rowIndex,
            columnIndex,
            direction: 'up',
          })
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          moveCell({
            table,
            row,
            rowIndex,
            columnIndex,
            direction: 'down',
          })
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          moveCell({
            table,
            row,
            rowIndex,
            columnIndex,
            direction: 'left',
          })
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          moveCell({
            table,
            row,
            rowIndex,
            columnIndex,
            direction: 'right',
          })
          break
        }
        // Allow copying of cell value when focused
        case 'C':
        case 'c': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const value = getValue()
            navigator.clipboard.writeText(value)
          }
          break
        }
      }
    },
    [
      isViewMode,
      row,
      rowIndex,
      table,
      columnIndex,
      tableMeta,
      focusOnFirstCell,
      getValue,
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

  useEffect(() => {
    if (isHighlightingCell) {
      cellContainerRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [isHighlightingCell])

  const hasMatchingSearch =
    tableMeta?.searchString !== '' &&
    value?.toLowerCase().includes(tableMeta?.searchString)

  return (
    <div
      style={{
        height: '100%',
        width: `${column.getSize()}px`,
        flexShrink: 0,
        cursor: 'default',
        borderBottomWidth: row.id === NEW_ROW_ID ? 0 : 1,
        borderRightWidth: 1,
        borderStyle: 'solid',
        borderColor: BORDER_COLOR.DEFAULT,
        zIndex: isEditingCell ? Z_INDEX_CELL.ACTIVE_CELL : Z_INDEX_CELL.DEFAULT,
      }}
      ref={cellContainerRef}
      className={styles.cell}
      onClick={startEditing}
    >
      {/* if editing new row, show text area for all cells in the row */}
      {isEditingCell ||
      (row.id === NEW_ROW_ID && editingRowId === NEW_ROW_ID) ? (
        <Textarea
          ref={textAreaRef}
          fontSize="0.875rem"
          h={ROW_HEIGHT.EXPANDED}
          background="white"
          borderColor="transparent"
          outline="none"
          _hover={{
            borderColor: 'primary.200',
          }}
          _focus={{
            borderColor: 'primary.400',
          }}
          isReadOnly={isViewMode}
          defaultValue={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          borderRadius={0}
          resize="none"
          spellCheck={false}
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
            backgroundColor: isHighlightingCell
              ? 'var(--chakra-colors-orange-200)'
              : hasMatchingSearch
              ? 'var(--chakra-colors-orange-100'
              : undefined,
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
