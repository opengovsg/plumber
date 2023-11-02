import { ITableColumnMetadata } from '@plumber/types'

import { Box } from '@chakra-ui/react'
import { ColumnDef, createColumnHelper } from '@tanstack/react-table'

import AddNewColumn from '../components/AddNewColumn'
import ColumnCell from '../components/ColumnCell'
import TableCell from '../components/TableCell'
import { GenericRowData } from '../types'

const columnHelper = createColumnHelper<GenericRowData>()

export function createColumns(
  columns: ITableColumnMetadata[],
): ColumnDef<GenericRowData, any>[] {
  const accessorColumns = columns.map(({ id, name }) =>
    columnHelper.accessor(id, {
      id,
      header: () => <ColumnCell columnId={id} columnName={name} />,
      cell: TableCell,
      minSize: 300,
    }),
  )
  const addNewColumn = columnHelper.display({
    id: 'addNew',
    header: () => <AddNewColumn />,
    cell: () => <Box bgColor="white" h="100%" w="100%" />,
    size: 50,
  })
  return [...accessorColumns, addNewColumn]
}
