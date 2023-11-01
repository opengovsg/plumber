import { ITableColumnMetadata, ITableRow } from '@plumber/types'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Box, Flex, useOutsideClick } from '@chakra-ui/react'
import {
  flexRender,
  getCoreRowModel,
  Row,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { DELAY, NEW_ROW_ID, ROW_HEIGHT } from '../constants'
import { createColumns } from '../helpers/columns-helper'
import { flattenRows } from '../helpers/flatten-rows'
import { scrollToBottom } from '../helpers/scroll-helper'
import { shallowCompare } from '../helpers/shallow-compare'
import { useCreateRow } from '../hooks/useCreateRow'
import { useUpdateRow } from '../hooks/useUpdateRow'
import { CellType, GenericRowData } from '../types'

import TableFooter from './TableFooter'

interface TableProps {
  tableId: string
  tableColumns: ITableColumnMetadata[]
  tableRows: ITableRow[]
}

export default function Table({
  tableId,
  tableColumns,
  tableRows,
}: TableProps): JSX.Element {
  const flatData = useMemo(() => flattenRows(tableRows), [tableRows])
  const columns = useMemo(() => createColumns(tableColumns), [tableColumns])
  const parentRef = useRef<HTMLDivElement>(null)

  const [data, setData] = useState<GenericRowData[]>(flatData)
  const [editingCell, setEditingCell] = useState<CellType | null>(null)
  // We use ref instead of state to prevent re-rendering on change
  // it's only used as a cache
  const tempRowData = useRef<GenericRowData | null>(null)

  const isAddingNewRow = data[data.length - 1].rowId === NEW_ROW_ID

  const rowVirtualizer = useVirtualizer({
    count: isAddingNewRow ? data.length - 1 : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index) =>
        index === editingCell?.row.index
          ? ROW_HEIGHT.EXPANDED
          : ROW_HEIGHT.DEFAULT,
      [editingCell?.row.index],
    ),
    overscan: 35,
  })

  const { rowsUpdating, updateRow } = useUpdateRow(tableId, setData)
  const { rowsCreated, createRow } = useCreateRow(tableId, setData)

  const setActiveCell = useCallback(
    (newCell: CellType | null) => {
      setEditingCell((currentCell) => {
        // If no previous cell is active or same row, do nothing
        if (currentCell?.row.id === newCell?.row.id) {
          return newCell
        }
        rowVirtualizer.measure()
        const rowDataToSave = tempRowData.current
        // If new cell is selected, store original row data in cache
        if (newCell) {
          tempRowData.current = { ...newCell?.row.original }
        }
        // if cache data has changed, save new data
        if (
          currentCell &&
          rowDataToSave &&
          !shallowCompare(currentCell.row.original, rowDataToSave)
        ) {
          if (rowDataToSave.rowId !== NEW_ROW_ID) {
            // update row
            updateRow(rowDataToSave)
          } else {
            // add new row
            createRow(rowDataToSave)
            scrollToBottom(parentRef)
          }
        }
        return newCell
      })
    },
    [createRow, rowVirtualizer, updateRow],
  )

  const addNewRow = useCallback(() => {
    if (!isAddingNewRow) {
      const newRow = {
        rowId: NEW_ROW_ID,
      } as GenericRowData
      setData((data) => [...data, newRow])
    } else {
      setData((data) => data.slice(0, data.length - 1))
    }
  }, [isAddingNewRow])

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.rowId,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    meta: {
      rowsUpdating,
      rowsCreated,
      tempRowData,
      activeCell: editingCell,
      setActiveCell,
      addNewRow,
      isAddingNewRow,
      focusOnNewRow: () => {
        setTimeout(() => {
          try {
            const newRowCell = table
              .getRow(NEW_ROW_ID)
              ?.getVisibleCells()[0] as CellType | null
            setActiveCell(newRowCell)
          } catch (_) {
            // no newRow found, do nothing
          }
        }, DELAY.FOCUS_CELL)
      },
    },
  })

  // Handle click outside of table
  useOutsideClick({
    ref: parentRef,
    handler: () => {
      setActiveCell(null)
    },
  })

  const { rows } = table.getRowModel()
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <Box borderRadius="lg" overflow="hidden">
      {table.getHeaderGroups().map((headerGroup) => (
        <Flex key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <Flex
              key={header.id}
              paddingX={4}
              paddingY={3}
              flexGrow={1}
              flexShrink={0}
              bgColor="primary.700"
              color="white"
              fontWeight="bold"
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
            </Flex>
          ))}
        </Flex>
      ))}

      <Box
        ref={parentRef}
        h="calc(100vh - 300px)"
        minH="300px"
        overflow="auto"
        position="relative"
        borderColor="primary.800"
        borderWidth={1}
        borderY="none"
      >
        <Box h={rowVirtualizer.getTotalSize()} w="100%">
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index] as Row<GenericRowData>
            return (
              <Flex
                key={row.id}
                w="100%"
                position="absolute"
                transform={`translateY(${virtualRow.start}px)`}
                alignItems="stretch"
                _even={{
                  bg: 'primary.50',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Flex key={cell.id} w="100%" padding={0}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Flex>
                ))}
              </Flex>
            )
          })}
        </Box>
        {isAddingNewRow && (
          <Flex
            w="100%"
            position="sticky"
            bottom={0}
            alignItems="stretch"
            bg="white"
            borderTopWidth={1}
            borderTopColor="primary.800"
          >
            {rows[rows.length - 1].getVisibleCells().map((cell) => (
              <Flex key={cell.id} w="100%" padding={0}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Flex>
            ))}
          </Flex>
        )}
      </Box>
      <TableFooter table={table} parentRef={parentRef} />
    </Box>
  )
}
