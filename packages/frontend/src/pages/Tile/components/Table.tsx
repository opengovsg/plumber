import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Box, Flex, useOutsideClick } from '@chakra-ui/react'
import {
  ColumnOrderState,
  createRow as createEmptyRow,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  Row,
  TableMeta,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import {
  BORDER_COLOR,
  HEADER_COLOR,
  NEW_ROW_ID,
  ROW_HEIGHT,
  TABLE_BANNER_HEIGHT,
  TEMP_ROW_ID_PREFIX,
  Z_INDEX,
} from '../constants'
import { useTableContext } from '../contexts/TableContext'
import { generateColumns } from '../helpers/columns-helper'
import { scrollToBottom } from '../helpers/scroll-helper'
import { shallowCompare } from '../helpers/shallow-compare'
import { useCreateRow } from '../hooks/useCreateRow'
import { useUpdateRow } from '../hooks/useUpdateRow'
import { CellType, GenericRowData } from '../types'

import SearchBar from './TableHeader/SearchBar'
import TableFooter from './TableFooter'
import TableHeader from './TableHeader'
import TableRow from './TableRow'

export default function Table(): JSX.Element {
  const { tableColumns, flattenedData, filteredDataRef, mode } =
    useTableContext()
  const [data, setData] = useState<GenericRowData[]>(flattenedData)
  const parentRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const childRef = useRef<HTMLDivElement>(null)
  const columns = useMemo(() => generateColumns(tableColumns), [tableColumns])
  const [rowSelection, setRowSelection] = useState({})
  const [searchString, setSearchString] = useState('')
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    columns.map((c) => c.id as string),
  )
  useEffect(() => {
    setColumnOrder(columns.map((c) => c.id as string))
  }, [columns])

  useEffect(() => {
    setData(flattenedData)
  }, [flattenedData])

  const [editingCell, setEditingCell] = useState<CellType | null>(null)
  const [highlightedCell, setHighlightedCell] = useState<CellType | null>(null)
  // We use ref instead of state to prevent re-rendering on change
  // it's only used as a cache
  const tempRowData = useRef<GenericRowData | null>(null)

  const { rowsUpdating, updateRow } = useUpdateRow(setData)
  const { rowsCreated, createRow } = useCreateRow(setData)

  const setActiveCell = useCallback(
    (newCell: CellType | null) => {
      setEditingCell((currentCell) => {
        // If no previous cell is active or same row, do nothing
        if (currentCell?.row.id === newCell?.row.id) {
          return newCell
        }
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
    [createRow, updateRow],
  )

  const removeRows = useCallback(
    (rowIds: string[]) => {
      const deletedRowIds = new Set(rowIds)
      setData((data) => data.filter((row) => !deletedRowIds.has(row.rowId)))
      setRowSelection({})
    },
    [setData],
  )

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.rowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: 'onChange',
    // debugAll: appConfig.isDev,
    enableRowSelection: (row) =>
      // prevent selection of new and temp rows
      row.id !== NEW_ROW_ID && !row.id.startsWith(TEMP_ROW_ID_PREFIX),
    onRowSelectionChange: setRowSelection,
    state: {
      columnOrder,
      rowSelection,
      rowPinning: {
        bottom: [NEW_ROW_ID],
      },
    },
    meta: {
      rowsUpdating,
      rowsCreated,
      tempRowData,
      activeCell: editingCell,
      setActiveCell,
      highlightedCell,
      setHighlightedCell,
      removeRows,
      searchString,
      setSearchString,
    },
  })

  const newRow = createEmptyRow(
    table,
    NEW_ROW_ID,
    { rowId: NEW_ROW_ID },
    data.length,
    0,
  )

  // Handle click outside of table
  useOutsideClick({
    ref: parentRef,
    handler: () => {
      setActiveCell(null)
    },
  })

  // Handle blur when user clicks on whitespace in table
  const onBlurClick = useCallback(
    (e: MouseEvent) => {
      if (
        [parentRef.current, containerRef.current, childRef.current].includes(
          e.target as HTMLDivElement,
        )
      ) {
        setActiveCell(null)
      }
    },
    [setActiveCell],
  )

  const { rows } = table.getRowModel()

  // this is for export csv
  useEffect(() => {
    filteredDataRef.current = rows.map((row) => row.original)
  }, [rows, filteredDataRef])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT.DEFAULT,
    // + 1 so the last cell's textarea bottom border is visible
    paddingEnd: ROW_HEIGHT.EXPANDED - ROW_HEIGHT.DEFAULT + 1,
    overscan: 20,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <Box position="relative">
      <Flex
        overflow="auto"
        w="100%"
        ref={parentRef}
        h={`calc(100vh - ${TABLE_BANNER_HEIGHT})`}
        minH="300px"
        flexDir="column"
        position="relative"
        // prevent active element from being hidden by footer
        scrollBehavior="smooth"
        // so that search bar results dont get blocked by header or footer
        scrollPaddingTop={ROW_HEIGHT.HEADER + 'px'}
        scrollPaddingBottom={ROW_HEIGHT.FOOTER + ROW_HEIGHT.DEFAULT + 'px'}
        // so highlighted element doesnt get blocked by checkbox column
        scrollPaddingLeft={60}
        onClick={onBlurClick}
      >
        <Flex
          flexDir="column"
          w="fit-content"
          minW="100%"
          flex={1}
          ref={containerRef}
        >
          <Flex
            bgColor={HEADER_COLOR.DEFAULT}
            alignItems="stretch"
            position="sticky"
            top={0}
            h={`${ROW_HEIGHT.HEADER}px`}
            maxH={`${ROW_HEIGHT.HEADER}px`}
            zIndex={Z_INDEX.FOOTER}
            borderTopWidth="1px"
            borderBottomWidth="1px"
            borderColor={BORDER_COLOR.DEFAULT}
            marginBottom="1px"
            fontWeight="bold"
          >
            <TableHeader
              setColumnOrder={setColumnOrder}
              headers={table.getFlatHeaders()}
              tableState={table.getState()}
            />
          </Flex>
          <Box h={rowVirtualizer.getTotalSize()} ref={childRef}>
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index] as Row<GenericRowData>
              if (row) {
                return (
                  <TableRow
                    key={row.id}
                    row={row}
                    tableMeta={table.options.meta as TableMeta<GenericRowData>}
                    virtualRow={virtualRow}
                  />
                )
              }
            })}
          </Box>
        </Flex>
        {mode === 'edit' && (
          <TableRow
            tableMeta={table.options.meta as TableMeta<GenericRowData>}
            row={newRow}
            stickyBottom
          />
        )}
        <TableFooter
          removeRows={removeRows}
          rowCount={rows.length}
          rowSelection={rowSelection}
          parentRef={parentRef}
        />
      </Flex>
      <SearchBar table={table} rowVirtualizer={rowVirtualizer} />
    </Box>
  )
}
