import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import { convertRowToHexEncodedRowRecord } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'

import getDataOutMetadata from './get-data-out-metadata'
import getTableRowImpl, { MAX_ROWS } from './implementation'
import { dataOutSchema, parametersSchema } from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const action: IRawAction = {
  name: 'Get table row',
  key: 'getTableRow',
  description: 'Gets a single row of data from your Excel table.',
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
      key: 'tableId',
      label: 'Table',
      required: true,
      // The MAX_ROWS row limit is a hard limit, but the cell limit is a soft
      // limit. The cell limit serves as messaging to tell users not to feed
      // enormous tables.
      description: `Tables should not have more than ${MAX_ROWS.toLocaleString()} rows or 100,000 cells.`,
      type: 'dropdown' as const,
      showOptionValue: false,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listTables',
          },
          {
            name: 'parameters.fileId',
            value: '{parameters.fileId}',
          },
        ],
      },
    },
    {
      key: 'lookupColumn' as const,
      type: 'dropdown' as const,
      showOptionValue: false,
      required: true,
      variables: false,
      label: 'Lookup Column',
      description:
        'Specify a column to look up. We will get the first row whose column matches the Lookup Value.',
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listTableColumns',
          },
          {
            name: 'parameters.fileId',
            value: '{parameters.fileId}',
          },
          {
            name: 'parameters.tableId',
            value: '{parameters.tableId}',
          },
        ],
      },
    },
    {
      key: 'lookupValue' as const,
      label: 'Lookup Value',
      // We don't support matching on Excel-formatted text because it's very
      // weird (e.g. currency cells have a trailing space), and will lead to too
      // much user confusion.
      description:
        "Value is case sensitive and should not include units e.g. if Excel shows '$5.20', enter '5.2'.",
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  getDataOutMetadata,

  async run($) {
    const parametersParseResult = parametersSchema.safeParse($.step.parameters)

    if (parametersParseResult.success === false) {
      throw new StepError(
        'There was a problem with the input.',
        parametersParseResult.error.issues[0].message,
        $.step?.position,
        $.app.name,
      )
    }

    const { fileId, tableId, lookupColumn, lookupValue } =
      parametersParseResult.data

    const session = await WorkbookSession.acquire($, fileId)
    const results = await getTableRowImpl({
      $,
      session,
      tableId,
      lookupValue,
      lookupColumn,
    })

    if (!results) {
      $.setActionItem({
        raw: {
          foundRow: false,
        } satisfies DataOut,
      })

      return
    }

    const { sheetRowNumber, row, columns } = results

    $.setActionItem({
      raw: {
        foundRow: true,
        // Hex-encode column names to account for our parameter regex.
        rowData: convertRowToHexEncodedRowRecord({
          row,
          columns,
        }),
        sheetRowNumber,
      } satisfies DataOut,
    })
  },
}

export default action
