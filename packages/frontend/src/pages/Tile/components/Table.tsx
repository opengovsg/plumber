import { ITableColumnMetadata, ITableRow } from '@plumber/types'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Box, Flex } from '@chakra-ui/react'
import {
  flexRender,
  getCoreRowModel,
  Row,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { createColumns } from '../helpers/columns-helper'
import { flattenRows } from '../helpers/flatten-rows'
import { shallowCompare } from '../helpers/shallow-compare'
import { useUpdateRow } from '../hooks/useUpdateRow'
import { CellType, GenericRowData } from '../types'

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

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 46,
    overscan: 35,
  })

  const { rowsUpdating, updateRow } = useUpdateRow(tableId)

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
          updateRow(rowDataToSave)
          setData((oldData) => {
            oldData[currentCell.row.index] = rowDataToSave
            return [...oldData]
          })
        }
        return newCell
      })
    },
    [tempRowData, updateRow],
  )

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.rowId,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    meta: {
      rowsUpdating,
      tempRowData,
      activeCell: editingCell,
      setActiveCell,
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
        h="calc(100vh - 250px)"
        minH="600px"
        overflow="auto"
        position="relative"
        borderColor="primary.800"
        borderBottomRadius="lg"
        borderWidth={1}
      >
        <Box height={rowVirtualizer.getTotalSize()} width="100%">
          {virtualRows.map((virtualRow, index) => {
            const row = rows[virtualRow.index] as Row<GenericRowData>
            return (
              <Flex
                key={row.id}
                transform={`translateY(${
                  virtualRow.start - index * virtualRow.size
                }px)`}
                alignItems="stretch"
                _even={{
                  bg: 'primary.50',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Flex
                    key={cell.id}
                    flexGrow={1}
                    flexShrink={0}
                    minH={virtualRow.size}
                    padding={0}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Flex>
                ))}
              </Flex>
            )
          })}
        </Box>
      </Box>
      {/* <pre>{JSON.stringify(data, null, "\t")}</pre> */}
    </Box>
  )
}
