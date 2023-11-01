import { ITableColumnMetadata } from '@plumber/types'

import { Box } from '@chakra-ui/react'
import { ColumnDef, createColumnHelper } from '@tanstack/react-table'

import TableCell from '../components/TableCell'
import { GenericRowData } from '../types'

const columnHelper = createColumnHelper<GenericRowData>()

export function createColumns(
  columns: ITableColumnMetadata[],
): ColumnDef<GenericRowData, any>[] {
  return columns.map(({ id, name }) =>
    columnHelper.accessor(id, {
      id,
      header: () => (
        <Box py={2} px={4}>
          {name}
        </Box>
      ),
      cell: TableCell,
      minSize: 200,
    }),
  )
}
