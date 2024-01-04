import type { IRawAction } from '@plumber/types'

import { generateStepError } from '@/helpers/generate-step-error'

import WorkbookSession from '../../common/workbook-session'

import type { DataOut } from './data-out'
import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Get cell value',
  key: 'get-cell-values',
  description: 'Gets the value of cells in a spreadsheet',
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
      label: 'Values',
      key: 'cells',
      type: 'multirow' as const,
      required: true,
      // We need to make 1 separate request for each cell, so limit to 3 as a
      // balance between convenience and API quota usage.
      description: 'Specify cells you want to get the values of. (Max 3)',
      subFields: [
        {
          label: 'Cell Address (e.g. A1)',
          key: 'address',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
  ],

  getDataOutMetadata,

  async run($) {
    const { fileId, worksheetId, cells: rawCells } = $.step.parameters
    const cells = (rawCells as Array<{ address: string }>).map((cell) => ({
      address: cell.address.trim(),
    }))

    // Basic sanity checks
    if (cells.length > 3) {
      throw generateStepError(
        'Too many cells',
        'Please only input up to 3 cells',
        $.step.position,
        $.app.key,
      )
    }

    for (const cell of cells) {
      if (!/^[a-zA-Z]+[1-9][0-9]*$/.test(cell.address)) {
        throw generateStepError(
          `Invalid cell address ${cell.address}`,
          'Please specify cell addresses in A1 notation.',
          $.step.position,
          $.app.key,
        )
      }
    }

    const session = await WorkbookSession.acquire($, fileId as string)

    const results: DataOut['results'] = await Promise.all(
      cells.map(async (cell) => {
        const response = await session.request<{ values: string[][] }>(
          `/worksheets/${worksheetId}/range(address='${cell.address}')`,
          'get',
        )
        return {
          cellAddress: cell.address,
          cellValue: response.data.values[0][0],
        }
      }),
    )

    $.setActionItem({
      raw: {
        results,
      },
    })
  },
}

export default action
