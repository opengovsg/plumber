import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_ITERATION_KEY,
} from '@/apps/toolbox/common/constants'

interface ProcessedColumn {
  id: string
  name: string
  value: string
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

function processColumns(data: MultipleRowObject): ProcessedColumn[] {
  const { columns, inputSource } = data
  if (columns.length === 0) {
    return []
  }

  const processedColumns = columns.map((column: any) => ({
    id: column.id,
    name: column.name,
    value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${column.id}`,
  }))

  // NOTE: only tiles will have rowId
  if (inputSource === FOR_EACH_INPUT_SOURCE.TILES) {
    processedColumns.push({
      id: 'rowId',
      name: 'Row ID',
      value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
    })
  }

  return processedColumns
}

export function processItems(items: MultipleRowObject): any {
  const processedColumns = processColumns(items)
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
