import { ITableColumnMetadata, ITableRow } from '@plumber/types'

import { Dispatch, useMemo, useRef, useState } from 'react'
import { useMutation } from '@apollo/client'
import { Box, Flex } from '@chakra-ui/react'
import {
  flexRender,
  getCoreRowModel,
  Row,
  RowData,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { UPDATE_ROW } from 'graphql/mutations/update-row'

import { createColumns } from '../helpers/columns-helper'
import { flattenRows, GenericRowData } from '../helpers/flatten-rows'
import { shallowCompare } from '../helpers/shallow-compare'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    editingRowId: string | null
    setEditingRow: (fn: (x: string | null) => string | null) => void
    updateData: (rowIndex: number, value: TData) => void
    removeRow: (rowIndex: number) => void
    editingCell: string | null
    setEditingCell: Dispatch<React.SetStateAction<string | null>>
    isSavingData: Record<string, boolean>
    rowData: GenericRowData | null
    setRowData: Dispatch<React.SetStateAction<GenericRowData | null>>
  }
}

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
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingRowData, setEditingRowData] = useState<GenericRowData | null>(
    null,
  )
  const [dataSaveState, setDataSaveState] = useState<Record<string, boolean>>(
    {},
  )
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 46,
    overscan: 35,
  })

  const [updateRow] = useMutation(UPDATE_ROW, {
    onCompleted: ({ updateRow: updatedRowId }) => {
      setDataSaveState((state) => {
        state[updatedRowId] = false
        return { ...state }
      })
      setTimeout(() => {
        setDataSaveState((state) => {
          delete state[updatedRowId]
          return { ...state }
        })
      }, 1000)
    },
  })

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.rowId,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    meta: {
      isSavingData: dataSaveState,
      editingRowId,
      rowData: editingRowData,
      setRowData: setEditingRowData,
      setEditingRow: (fn: (x: string | null) => string | null) => {
        setEditingRowId((prevEditingRowId) => {
          const newEditingRowId = fn(prevEditingRowId)
          if (prevEditingRowId === newEditingRowId) {
            return newEditingRowId
          }
          if (prevEditingRowId) {
            const row = table.getRow(prevEditingRowId)
            if (row && editingRowData) {
              if (!shallowCompare(row.original, editingRowData)) {
                const { rowId, ...rowData } = editingRowData
                setDataSaveState((state) => {
                  state[rowId] = true
                  return { ...state }
                })
                updateRow({
                  variables: {
                    input: {
                      tableId,
                      rowId,
                      data: rowData,
                    },
                  },
                })
                setData((old) => {
                  old[row.index] = editingRowData
                  return [...old]
                })
              }
            }
          }
          if (newEditingRowId) {
            setEditingRowData(table.getRow(newEditingRowId)?.original ?? null)
          }
          return newEditingRowId
        })
      },
      editingCell,
      setEditingCell,
      updateData: (rowIndex: number, value: GenericRowData) => {
        setData((old) => {
          old[rowIndex] = value
          return [...old]
        })
      },
      removeRow: (rowIndex: number) => {
        const setFilterFunc = (old: GenericRowData[]) =>
          old.filter(
            (_row: GenericRowData, index: number) => index !== rowIndex,
          )
        setData(setFilterFunc)
      },
    },
  })

  const { rows } = table.getRowModel()
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <Box
      borderRadius="lg"
      overflow="hidden"
      // onBlur={() => {
      //   table.options.meta?.setEditingRow(() => null)
      //   setEditingCell(null)
      // }}
    >
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
