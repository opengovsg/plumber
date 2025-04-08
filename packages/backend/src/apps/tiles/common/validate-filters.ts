import IntermediateStepError from '@/errors/intermediate-step-error'
import logger from '@/helpers/logger'
import {
  type TableRowFilter,
  TableRowFilterOperator,
  type TableRowIndexName,
} from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

interface ValidateFiltersResult {
  filters: TableRowFilter[]
  gsi?: {
    indexName: TableRowIndexName
    filter: TableRowFilter
  }
}

const VALID_GSI_STRING_OPERATORS = [
  TableRowFilterOperator.Equals,
  TableRowFilterOperator.BeginsWith,
]

const VALID_GSI_NUMBER_OPERATORS = [
  TableRowFilterOperator.GreaterThan,
  TableRowFilterOperator.GreaterThanOrEquals,
  TableRowFilterOperator.LessThan,
  TableRowFilterOperator.LessThanOrEquals,
  TableRowFilterOperator.Equals,
]

export function validateFilters(
  filters: TableRowFilter[],
  columns: TableColumnMetadata[],
): ValidateFiltersResult {
  const columnIdMap: Record<string, TableColumnMetadata> = {}
  for (const column of columns) {
    columnIdMap[column.id] = column
  }
  const result: ValidateFiltersResult = {
    filters: [],
    gsi: undefined,
  }
  for (const filter of filters) {
    const column = columnIdMap[filter.columnId]
    if (
      !column ||
      !Object.values(TableRowFilterOperator).includes(filter.operator)
    ) {
      logger.error({
        message: 'Invalid filters',
        action: 'find-single-row',
        columnId: filter.columnId,
      })
      throw new IntermediateStepError(
        'Invalid columnId',
        'One or more filters are invalid. Please check that the columns in your filters still exist',
      )
    }
    if (column.config?.gsi?.status === 'ready') {
      switch (column.config.gsi.type) {
        case 'string':
          if (VALID_GSI_STRING_OPERATORS.includes(filter.operator)) {
            result.gsi = {
              indexName: column.config.gsi.indexName as TableRowIndexName,
              filter,
            }
            continue
          }
          break
        case 'number':
          if (VALID_GSI_NUMBER_OPERATORS.includes(filter.operator)) {
            result.gsi = {
              indexName: column.config.gsi.indexName as TableRowIndexName,
              filter,
            }
            continue
          }
          break
        default:
          // do nothing - do not treat as valid GSI filter
          break
      }
    }
    result.filters.push(filter)
  }
  return result
}
