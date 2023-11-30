import type { IRawAction } from '@plumber/types'

import { generateStepError } from '@/helpers/generate-step-error'

import { runWithM365RequestSafetyNet } from '../../common/request-safety-net'
import WorkbookSession from '../../common/workbook-session'

const action: IRawAction = {
  name: 'Get cell value',
  key: 'get-cell-value',
  description: 'Gets the value of a cell in a spreadsheet',
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'File to edit',
      type: 'dropdown' as const,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listFiles',
          },
        ],
      },
    },
    {
      key: 'worksheetId',
      label: 'Worksheet',
      required: true,
      description: 'Worksheet to query',
      type: 'dropdown' as const,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listWorksheets',
          },
          {
            name: 'parameters.fileId',
            value: '{parameters.fileId}',
          },
        ],
      },
    },
    {
      label: 'Column (e.g. A)',
      key: 'column',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Row (e.g. 10)',
      key: 'row',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    return await runWithM365RequestSafetyNet($, async () => {
      const { fileId, worksheetId, column, row } = $.step.parameters

      // Basic sanity checks
      if (isNaN(Number(row))) {
        throw generateStepError(
          'Row is not a number',
          'Please enter only numbers in the row field.',
          $.step.position,
          $.app.key,
        )
      }
      if (/^[a-zA-Z]+$/.test(column as string)) {
        throw generateStepError(
          'Column contains non-alphabet characters',
          'Please enter only alphabets in the column field.',
          $.step.position,
          $.app.key,
        )
      }

      const session = await WorkbookSession.create($, fileId as string)

      const result = await session.request<{ values: unknown[][] }>(
        `/worksheets/${worksheetId}/range(address='${(
          column as string
        ).toLowerCase()}${row}')`,
        'get',
      )

      await session.closeIfLastExcelStepInPipe()

      $.setActionItem({
        raw: {
          cellValue: String(result.data.values[0][0]),
        },
      })
    })
  },
}

export default action
