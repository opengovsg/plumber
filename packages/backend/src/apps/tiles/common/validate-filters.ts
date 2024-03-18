import { TableRowFilter } from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

export function validateFilters(
  filters: TableRowFilter[],
  columns: TableColumnMetadata[],
) {
  const columnIds = columns.map((c) => c.id)
  const columnIdSet = new Set(columnIds)
  for (const filter of filters) {
    if (!columnIdSet.has(filter.columnId)) {
      throw new Error(`Invalid columnId: ${filter.columnId}`)
    }
  }
}
