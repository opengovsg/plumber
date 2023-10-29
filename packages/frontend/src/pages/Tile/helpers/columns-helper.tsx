import { ITableColumnMetadata } from '@plumber/types'

import { ColumnDef, createColumnHelper } from '@tanstack/react-table'

import { TableCell } from '../components/TableCell'
import { GenericRowData } from '../types'

const columnHelper = createColumnHelper<GenericRowData>()

export function createColumns(
  columns: ITableColumnMetadata[],
): ColumnDef<GenericRowData, any>[] {
  return columns.map(({ id, name }) =>
    columnHelper.accessor(id, {
      id,
      header: () => <span>{name}</span>,
      cell: TableCell,
    }),
  )
}
