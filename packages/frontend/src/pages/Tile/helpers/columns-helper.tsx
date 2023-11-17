import { ITableColumnMetadata } from '@plumber/types'

import { Box } from '@chakra-ui/react'
import { ColumnDef, createColumnHelper } from '@tanstack/react-table'

import CheckboxHeaderCell from '../components/TableHeader/CheckboxHeaderCell'
import ColumnHeaderCell from '../components/TableHeader/ColumnHeaderCell'
import NewColumnHeaderCell from '../components/TableHeader/NewColumnHeaderCell'
import CheckboxCell from '../components/TableRow/CheckboxCell'
import TableCell from '../components/TableRow/TableCell'
import { NEW_COLUMN_ID, SELECT_COLUMN_ID } from '../constants'
import { GenericRowData } from '../types'

const columnHelper = createColumnHelper<GenericRowData>()

export function createColumns(
  columns: ITableColumnMetadata[],
): ColumnDef<GenericRowData, any>[] {
  const accessorColumns = columns.map(({ id, name, config }) =>
    columnHelper.accessor(id, {
      id,
      header: ({ header }) => (
        <ColumnHeaderCell columnName={name} header={header} />
      ),
      cell: TableCell,
      minSize: 100,
      size: config?.width ?? 200,
    }),
  )
  const selectColumn = columnHelper.display({
    id: SELECT_COLUMN_ID,
    header: CheckboxHeaderCell,
    cell: CheckboxCell,
    size: 40,
  })
  const addNewColumn = columnHelper.display({
    id: NEW_COLUMN_ID,
    header: NewColumnHeaderCell,
    cell: () => <Box bgColor="white" h="100%" w="100%" />,
    size: 50,
  })
  return [selectColumn, ...accessorColumns, addNewColumn]
}
