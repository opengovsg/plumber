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

import { GenericRowData } from '../helpers/flatten-rows'

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
  const isEditingRow = tableMeta?.editingRowId === row.id
  const isEditingCell = tableMeta?.editingCell === cell.id

  const value = isEditingRow ? tableMeta?.rowData?.[column.id] : getValue()

  const columnIds = table.getAllLeafColumns().map((c) => c.id)

  const isSavingRow = tableMeta?.isSavingData[row.id]

  const startEditing = useCallback(
    (
      e:
        | FocusEvent<HTMLInputElement | HTMLTextAreaElement>
        | MouseEvent<HTMLDivElement>,
    ) => {
      tableMeta?.setEditingRow(() => row.id)
      tableMeta?.setEditingCell(cell.id)
      if (e.target instanceof HTMLTextAreaElement) {
        e.target.select()
      }
    },
    [cell.id, row.id, tableMeta],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const nextRowId = table.getSortedRowModel().rows[row.index + 1]?.id
        tableMeta?.setEditingRow((currentRowId) => {
          if (currentRowId && nextRowId) {
            return nextRowId
          }
          return null
        })
        tableMeta?.setEditingCell((currentCellId) => {
          if (currentCellId) {
            return `${nextRowId}_${column.id}`
          }
          return null
        })
      }
      // on tab
      if (e.key === 'Tab') {
        e.preventDefault()
        tableMeta?.setEditingCell((currentCellId) => {
          if (currentCellId) {
            const columnId = column.id
            const columnIndex = columnIds.indexOf(columnId)
            const increment = e.shiftKey ? -1 : 1
            const nextColumnIndex = Math.min(
              Math.max(0, columnIndex + increment),
              columnIds.length - 1,
            )
            const nextColumnId = columnIds[nextColumnIndex]
            return `${row.id}_${nextColumnId}`
          }
          return null
        })
      }
    },
    [table, row.index, row.id, tableMeta, column.id, columnIds],
  )

  const onValueChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      tableMeta?.setRowData(
        (currentRowData) =>
          ({
            ...currentRowData,
            [column.id]: e.target.value,
          } as GenericRowData),
      )
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
          value={value}
          onChange={onValueChange}
          _focusWithin={{
            boxShadow: 'none',
            bgColor: 'primary.100',
          }}
          rows={5}
          minH="100%"
          h="100%"
          onKeyDown={onKeyDown}
          borderRadius={0}
          autoFocus={isEditingCell}
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
          {value}
        </Flex>
      )}
    </Box>
  )
}
