import type { IRawAction } from '@plumber/types'
import z from 'zod'

import StepError from '@/errors/step'

import {
  LOOKUP_CONDITIONS_SUBFIELDS,
  MAX_LOOKUP_CONDITIONS,
} from '../../common/constants'
import { lookupParametersSchema } from '../../common/schema'
import { convertRowToHexEncodedRowRecord } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'
import { RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024 } from '../../FOR_RELEASE_PERIOD_ONLY'
import getDataOutMetadata from './get-data-out-metadata'
import getTableRowImpl, { MAX_ROWS } from './implementation'
import { dataOutSchema } from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const action: IRawAction = {
  name: 'Find table row',
  key: 'getTableRow',
  description: 'Gets a single row of data from your Excel table',
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
      key: 'filters',
      label: 'Lookup conditions',
      description:
        'Lookup values are case sensitive and should not include units (e.g., $5.20 → 5.2). Leave blank to search for empty cells.',
      type: 'multirow-multicol' as const,
      required: true,
      subFields: LOOKUP_CONDITIONS_SUBFIELDS,
      maxRows: MAX_LOOKUP_CONDITIONS,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
    },
  ],

  getDataOutMetadata,

  async run($) {
    // FOR RELEASE ONLY TO STEM ANY THUNDERING HERDS; REMOVE AFTER 21 Jul 2024.
    if ($.execution.testRun) {
      await RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024($.user?.email, $)
    }

    const parametersParseResult = lookupParametersSchema.safeParse(
      $.step.parameters,
    )

    if (parametersParseResult.success === false) {
      throw new StepError(
        'There was a problem with the input.',
        parametersParseResult.error.issues[0].message,
      )
    }

    const { fileId, tableId, filters } = parametersParseResult.data

    const session = await WorkbookSession.acquire($, fileId)
    const results = await getTableRowImpl({
      $,
      session,
      tableId,
      filters,
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
        columns,
      } satisfies DataOut,
    })
  },
}

export default action
