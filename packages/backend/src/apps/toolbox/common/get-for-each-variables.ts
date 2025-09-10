import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_ITERATION_KEY,
} from '@/apps/toolbox/common/constants'

export interface ProcessedColumn {
  id: string
  name: string
  value: string
  order: number
}

export interface MultipleRowObject {
  rows: {
    data: Record<string, string | number | null>
    rowId?: string
  }[]
  columns: {
    id: string
    name: string
    value: string
  }[]
  inputSource: FOR_EACH_INPUT_SOURCE
}

export function isCheckboxItems(items: any[]): boolean {
  return Array.isArray(items) && items.every((item) => typeof item === 'string')
}

function processColumns(
  data: MultipleRowObject,
  columnDataOutType: 'array' | 'object', // TODO (kevinkim-ogp): remove this once all users have moved to the new format
): Record<string, ProcessedColumn> | ProcessedColumn[] {
  const { columns, inputSource } = data
  if (columns.length === 0) {
    return columnDataOutType === 'array' ? [] : {}
  }

  /**
   * NOTE: this is for backward compatibility with the old dataOut format
   * which is unable to properly support reordering of Tiles or Excel columns
   * as the columns are found by their relative position in an array
   *
   * TODO: remove this once all users have moved the new dataOut format
   */
  if (columnDataOutType === 'array') {
    const processedColumns = columns.map((column: any, index: number) => ({
      id: column.id,
      name: column.name,
      value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${column.id}`,
      order: index + 1,
    }))

    // NOTE: only tiles will have rowId
    if (inputSource === FOR_EACH_INPUT_SOURCE.TILES) {
      processedColumns.push({
        id: 'rowId',
        name: 'Row ID',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
        order: columns.length + 1,
      })
    }
    return processedColumns
  }

  /**
   * NOTE: this is the new dataOut format for columns
   * which is able to properly support reordering of Tiles or Excel columns
   * it will still map to the correct column and value even if the columns are
   * reordered as the columns are found by their IDs and not their relative
   * position in an array
   */
  const processedColumns: Record<string, ProcessedColumn> = {}
  columns.forEach((column: any, index: number) => {
    processedColumns[column.id] = {
      id: column.id,
      name: column.name,
      value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${column.id}`,
      order: index + 1,
    }
  })

  if (inputSource === FOR_EACH_INPUT_SOURCE.TILES) {
    processedColumns['rowId'] = {
      id: 'rowId',
      name: 'Row ID',
      value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
      order: columns.length + 1,
    }
  }

  return processedColumns
}

export function processItems(
  items: MultipleRowObject,
  columnDataOutType: 'array' | 'object', // TODO (kevinkim-ogp): remove this once all users have moved to the new format
): any {
  const processedColumns = processColumns(items, columnDataOutType)
  const processedItems = {
    rows: items.rows,
    columns: processedColumns,
    inputSource: items.inputSource,
  }
  return processedItems
}

// sample inputList formats
// checkbox: ['item1', 'item2', 'item3']
// tiles / m365-excel:
// only tiles will have rowId
// we add inputSource to the data object to make it easier to infer the inputSource
// {
//   "data": {
//     "rows": [
//       {
//         "data": {
//           "42ce85b6-4164-4d8a-ace6-1f0546aaec77": "No",
//           "5fcec920-8f2d-438e-bbac-dd0ba118b33a": "Jane Doe",
//           "746b5d5c-9243-47da-b123-53a0fb0be99b": "jane@email.com"
//         },
//         "rowId": "5ad4b20f-2610-47f4-9003-d8ca8261e482"
//       },
//       {
//         "data": {
//           "42ce85b6-4164-4d8a-ace6-1f0546aaec77": "Yes",
//           "5fcec920-8f2d-438e-bbac-dd0ba118b33a": "John Doe",
//           "746b5d5c-9243-47da-b123-53a0fb0be99b": "john@email.com"
//         },
//         "rowId": "4ea0b5be-ebde-4c40-a4dc-6d49fea21174"
//       }
//     ],
//     "columns": [
//       {
//         "id": "5fcec920-8f2d-438e-bbac-dd0ba118b33a",
//         "name": "Name",
//         "value": "data.rows.*.data.5fcec920-8f2d-438e-bbac-dd0ba118b33a"
//       },
//       {
//         "id": "746b5d5c-9243-47da-b123-53a0fb0be99b",
//         "name": "Email",
//         "value": "data.rows.*.data.746b5d5c-9243-47da-b123-53a0fb0be99b"
//       },
//       {
//         "id": "42ce85b6-4164-4d8a-ace6-1f0546aaec77",
//         "name": "Attended?",
//         "value": "data.rows.*.data.42ce85b6-4164-4d8a-ace6-1f0546aaec77"
//       }
//     ],
//     "inputSource": "tiles"
//   },
//   "rowsFound": 2
// }
