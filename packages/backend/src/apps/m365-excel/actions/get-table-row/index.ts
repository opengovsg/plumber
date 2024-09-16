import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import { validateDynamicFieldsAndThrowError } from '../../common/validate-dynamic-fields'
import { convertRowToHexEncodedRowRecord } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'
import { RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024 } from '../../FOR_RELEASE_PERIOD_ONLY'

import getDataOutMetadata from './get-data-out-metadata'
import getTableRowImpl, { MAX_ROWS } from './implementation'
import { dataOutSchema, parametersSchema } from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const action: IRawAction = {
  name: 'Find table row',
  key: 'getTableRow',
  description: 'Gets a single row of data from your Excel table',
  settingsStepLabel: 'Set up row to get',
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'This should be an Excel file in the folder created for you',
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
      description: `Tables should not have more than ${MAX_ROWS.toLocaleString()} rows or 100,000 cells`,
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
      label: 'Lookup column',
      description:
        'If multiple rows meet your condition, the topmost entry will be returned',
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
        'Case sensitive and should not include units. E.g. $5.20 → 5.2',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  getDataOutMetadata,

  async run($) {
    // FOR RELEASE ONLY TO STEM ANY THUNDERING HERDS; REMOVE AFTER 21 Jul 2024.
    if ($.execution.testRun) {
      await RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024($.user?.email, $)
    }

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

    // Validation to prevent path traversals
    validateDynamicFieldsAndThrowError(fileId, tableId, $)

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
