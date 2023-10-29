import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { Box, Flex, Textarea } from '@chakra-ui/react'
import { CellContext } from '@tanstack/react-table'

import { CellType, GenericRowData } from '../types'

import styles from './TableCell.module.css'

export const TableCell = ({
  getValue,
  row,
  column,
  table,
  cell,
}: CellContext<GenericRowData, string>) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const tableMeta = table.options.meta
  const isEditingRow = tableMeta?.activeCell?.row.id === row.id
  const isEditingCell = tableMeta?.activeCell?.id === cell.id

  const originalValue = getValue()
  const columnIds = table.getAllLeafColumns().map((c) => c.id)

  const isSavingRow = tableMeta?.rowsUpdating[row.id]

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

  return (
    <Box
      h="100%"
      w="100%"
      alignItems="center"
      onClick={startEditing}
      cursor="default"
      borderWidth="0.5px"
      borderStyle="solid"
      borderColor={isEditingCell ? 'primary.600' : 'primary.50'}
      _hover={{
        bg: isEditingRow ? 'transparent' : 'gray.50',
      }}
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
          minH="100%"
          h="100%"
          onKeyDown={onKeyDown}
          borderRadius={0}
          borderWidth={0}
        />
      ) : (
        <Flex
          h="100%"
          w="100%"
          minWidth="100%"
          maxW={0}
          alignItems="center"
          px={4}
          wordBreak="break-word"
          className={
            isSavingRow === true
              ? styles.saving
              : isSavingRow === false
              ? styles.saved
              : undefined
          }
        >
          {originalValue}
        </Flex>
      )}
    </Box>
  )
}
