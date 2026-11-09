import TableColumnMetadata from '@/models/table-column-metadata'
import { TableRowFilter, TableRowFilterOperator } from '@/models/tiles/types'

const SUPPORTED_OPERATORS = new Set<string>(
  Object.values(TableRowFilterOperator),
)

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

export function validateFilterOperators(filters: TableRowFilter[]) {
  for (const filter of filters) {
    if (!SUPPORTED_OPERATORS.has(filter.operator)) {
      throw new Error(`Unsupported filter operator: ${filter.operator}`)
    }
  }
}

/**
 * Matches DynamoDB, which rejects a query naming a column no condition uses,
 * so pipes it lets through keep running.
 */
export function validateDynamoDbFilterOperators(filters: TableRowFilter[]) {
  const filteredColumnIds = new Set(
    filters
      .filter((filter) => SUPPORTED_OPERATORS.has(filter.operator))
      .map((filter) => filter.columnId),
  )
  for (const filter of filters) {
    if (
      !SUPPORTED_OPERATORS.has(filter.operator) &&
      !filteredColumnIds.has(filter.columnId)
    ) {
      throw new Error(`Unsupported filter operator: ${filter.operator}`)
    }
  }
}
