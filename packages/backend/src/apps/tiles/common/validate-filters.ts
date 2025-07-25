import TableColumnMetadata from '@/models/table-column-metadata'
import { TableRowFilter } from '@/models/tiles/types'

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
