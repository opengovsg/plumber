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
import { useTableContext } from '../contexts/TableContext'
import { createColumns } from '../helpers/columns-helper'
import { scrollToBottom } from '../helpers/scroll-helper'
import { shallowCompare } from '../helpers/shallow-compare'
import { useCreateRow } from '../hooks/useCreateRow'
import { useUpdateRow } from '../hooks/useUpdateRow'
import { CellType, GenericRowData } from '../types'

import ColumnResizer from './ColumnResizer'
import TableFooter from './TableFooter'
import TableRow from './TableRow'

export default function Table(): JSX.Element {
  const { tableColumns, flattenedData } = useTableContext()
  const [data, setData] = useState<GenericRowData[]>(flattenedData)
  const parentRef = useRef<HTMLDivElement>(null)
  const columns = useMemo(() => createColumns(tableColumns), [tableColumns])

  const [editingCell, setEditingCell] = useState<CellType | null>(null)
  // We use ref instead of state to prevent re-rendering on change
  // it's only used as a cache
  const tempRowData = useRef<GenericRowData | null>(null)

  const isAddingNewRow = data[data.length - 1]?.rowId === NEW_ROW_ID

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

  const { rowsUpdating, updateRow } = useUpdateRow(setData)
  const { rowsCreated, createRow } = useCreateRow(setData)

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
    columnResizeMode: 'onChange',
    debugColumns: true,
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
    <Flex
      borderRadius="lg"
      overflow="auto"
      w="100%"
      borderColor="primary.800"
      borderWidth={1}
      ref={parentRef}
      h="calc(100vh - 210px)"
      minH="300px"
      flexDir="column"
      position="relative"
    >
      <Flex flexDir="column" w="fit-content" minW="100%" flex={1}>
        <Flex
          bgColor="primary.700"
          alignItems="stretch"
          position="sticky"
          top={0}
          zIndex={10}
        >
          {table.getFlatHeaders().map((header) => (
            <Box
              key={header.id}
              p={0}
              w={header.getSize()}
              color="white"
              fontWeight="bold"
              position="relative"
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
              {header.id !== 'addNew' && <ColumnResizer header={header} />}
            </Box>
          ))}
        </Flex>

        <Box position="relative" borderY="none">
          {rows.length ? (
            <Box h={rowVirtualizer.getTotalSize()}>
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index] as Row<GenericRowData>
                return (
                  <TableRow key={row.id} row={row} virtualRow={virtualRow} />
                )
              })}
            </Box>
          ) : (
            <>{/* insert some call to action to add new row here */}</>
          )}
          {isAddingNewRow && (
            <TableRow row={rows[rows.length - 1]} stickyBottom />
          )}
        </Box>
      </Flex>
      <TableFooter table={table} parentRef={parentRef} />
    </Flex>
  )
}
