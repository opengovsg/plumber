import { FOR_EACH_INPUT_SOURCE, FOR_EACH_ITERATION_KEY } from './constants'

type InputSource = FOR_EACH_INPUT_SOURCE | null

interface ProcessedInput {
  iterations: number
  processedItems: any
  inputSource: InputSource
}

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
}

export function isCheckboxItems(items: string[]): boolean {
  return Array.isArray(items) && items.every((item) => typeof item === 'string')
}

function processColumns(data: MultipleRowObject): {
  inputSource: InputSource
  processedColumns: ProcessedColumn[]
} {
  const processedColumns: ProcessedColumn[] = []
  let inputSource = null

  data.columns.forEach((column: any) => {
    processedColumns.push({
      id: column.id,
      name: column.name,
      value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${column.id}`,
    })
  })

  // NOTE: only tiles will have rowId
  if (data.rows[0]?.rowId) {
    processedColumns.push({
      id: 'rowId',
      name: 'Row ID',
      value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
    })
    inputSource = FOR_EACH_INPUT_SOURCE.TILES
  } else if (data.rows.length > 0) {
    inputSource = FOR_EACH_INPUT_SOURCE.M365_EXCEL
  }

  return { inputSource, processedColumns }
}

export function processItems(items: MultipleRowObject): ProcessedInput {
  let iterations = items.rows.length
  const { inputSource, processedColumns } = processColumns(items)
  const processedItems = {
    rows: items.rows,
    columns: processedColumns,
  }
  iterations = items.rows.length

  return {
    iterations,
    processedItems,
    inputSource,
  }
}

// sample inputList formats
// checkbox: ['item1', 'item2', 'item3']
// tiles / m365-excel:
// only tiles will have rowId
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
//     ]
//   },
//   "rowsFound": 2
// }
