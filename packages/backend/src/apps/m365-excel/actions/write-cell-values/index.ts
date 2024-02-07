import type { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import WorkbookSession from '../../common/workbook-session'

import { parametersSchema } from './parameters-schema'

const action: IRawAction = {
  name: 'Write cell values',
  key: 'writeCellValues',
  description: "Write values into your Excel worksheet's cells",
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'This should be a file in your Plumber folder.',
      type: 'dropdown' as const,
      showOptionValue: false,
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
      description: 'Worksheet to edit',
      type: 'dropdown' as const,
      showOptionValue: false,
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
      description:
        'Specify cells you want to write values to (max 3). Leave a value blank to clear the cell.',
      subFields: [
        {
          label: 'Cell Address (e.g. A1)',
          key: 'address',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          label: 'Value',
          key: 'value',
          type: 'string' as const,
          required: false,
          variables: true,
        },
      ],
    },
  ],

  async run($) {
    const parametersParseResult = parametersSchema.safeParse($.step.parameters)

    if (parametersParseResult.success === false) {
      throw new StepError(
        'Action is set up incorrectly.',
        parametersParseResult.error.issues[0].message,
        $.step?.position,
        $.app.name,
      )
    }

    const { fileId, worksheetId, cells } = parametersParseResult.data
    const session = await WorkbookSession.acquire($, fileId)

    await Promise.all(
      cells.map(async (cell) =>
        session.request(
          `/worksheets/${worksheetId}/range(address='${cell.address}')`,
          'patch',
          {
            data: {
              values: [[cell.value]],
            },
          },
        ),
      ),
    )

    $.setActionItem({
      raw: {
        success: true,
      },
    })
  },
}

export default action
