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
import { Box, Flex, Textarea } from '@chakra-ui/react'
import { CellContext } from '@tanstack/react-table'

import { NEW_ROW_ID, TEMP_ROW_ID_PREFIX } from '../constants'
import { shallowCompare } from '../helpers/shallow-compare'
import { CellType, GenericRowData } from '../types'

import styles from './TableCell.module.css'

export default function TableCell({
  getValue,
  row,
  column,
  table,
  cell,
}: CellContext<GenericRowData, string>) {
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
      if (e.target instanceof HTMLTextAreaElement) {
        e.target.select()
      }
    },
    [cell, tableMeta],
  )

  const getCell = useCallback(
    (rowId: string, columnId: string) => {
      const row = table.getRow(rowId)
      const rowCells = row.getAllCells()
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
        if (row.id === NEW_ROW_ID) {
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
        const nextRowId = table.getSortedRowModel().rows[row.index + 1]?.id
        const nextActiveCell = getCell(nextRowId, column.id)
        tableMeta?.setActiveCell(nextActiveCell)
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
      }

      if (e.key === 'Escape') {
        tableMeta?.setActiveCell(null)
      }
    },
    [table, row, getCell, column.id, tableMeta, columnIds],
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
    <Box
      h="100%"
      minH="50px"
      w="100%"
      alignItems="center"
      onClick={startEditing}
      cursor="default"
      borderWidth="0.5px"
      borderStyle="solid"
      borderColor={isEditingCell ? 'primary.600' : 'primary.100'}
      _hover={{
        bg: isEditingRow ? 'transparent' : 'gray.50',
      }}
      position={row.id === 'new-row' ? 'sticky' : undefined}
      bottom={row.id === 'new-row' ? 0 : undefined}
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
          _focusWithin={{
            boxShadow: 'none',
            bgColor: 'primary.100',
          }}
          rows={5}
          resize="none"
          h="130px"
          onKeyDown={onKeyDown}
          borderRadius={0}
          borderWidth={0}
        />
      ) : (
        <Flex
          h="48px"
          w="100%"
          minWidth="100%"
          maxW={0}
          alignItems="flex-start"
          px={4}
          wordBreak="break-word"
          className={className}
          overflow="hidden"
        >
          {originalValue}
        </Flex>
      )}
    </Box>
  )
}
