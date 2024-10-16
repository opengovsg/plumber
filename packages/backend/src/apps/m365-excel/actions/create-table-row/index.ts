import type { IGlobalVariable, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import { sanitiseInputValue } from '../../common/sanitise-formula-input'
import { validateDynamicFieldsAndThrowError } from '../../common/validate-dynamic-fields'
import { constructMsGraphValuesArrayForRowWrite } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'
import { RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024 } from '../../FOR_RELEASE_PERIOD_ONLY'

import getDataOutMetadata from './get-data-out-metadata'
import { parametersSchema } from './schemas'

// Small wrapper around constructMsGraphValuesArrayForRowWrite which throws
// StepError. As StepError requires $, this helps avoid $ becoming viral through
// our codebase.
//
// constructMsGraphValuesArrayForRowWrite is a generic helper function and
// should not be restricted to codepaths with $.
function buildRowUpdateArgs(
  $: IGlobalVariable,
  ...args: Parameters<typeof constructMsGraphValuesArrayForRowWrite>
): ReturnType<typeof constructMsGraphValuesArrayForRowWrite> {
  try {
    return constructMsGraphValuesArrayForRowWrite(...args)
  } catch (err) {
    throw new StepError(
      `Error creating table row: ${err.message}`,
      'Double check that your step is configured correctly',
      $.step.position,
      $.app.name,
    )
  }
}

interface TableHeaderInfo {
  rowIndex: number
  columnNames: string[] // Ordered
}

const action: IRawAction = {
  name: 'Create table row',
  key: 'createTableRow',
  description: 'Creates a new row in your Excel table',
  settingsStepLabel: 'Set up row to create',
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
      label: 'New row data',
      key: 'columnValues',
      type: 'multirow' as const,
      required: true,
      subFields: [
        {
          key: 'columnName' as const,
          type: 'dropdown' as const,
          showOptionValue: false,
          required: true,
          variables: false,
          placeholder: 'Column',
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
          key: 'value' as const,
          type: 'string' as const,
          required: true,
          variables: true,
          placeholder: 'Value',
        },
      ],
    },
  ],

  getDataOutMetadata,

  async run($) {
    if ($.execution.testRun) {
      // FOR RELEASE ONLY TO STEM ANY THUNDERING HERDS; REMOVE AFTER 21 Jul 2024.
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

    const { fileId, tableId, columnValues } = parametersParseResult.data

    // Validation to prevent path traversals
    validateDynamicFieldsAndThrowError({
      fileId,
      tableId,
      $,
    })

    const session = await WorkbookSession.acquire($, fileId as string)

    const tableHeaderInfoResponse = await session.request<{
      rowIndex: number
      values: string[][] // Guaranteed to be length 1 at top level
    }>(`/tables/${tableId}/headerRowRange?$select=rowIndex,values`, 'get')
    const tableHeaderInfo: TableHeaderInfo = {
      rowIndex: tableHeaderInfoResponse.data.rowIndex,
      columnNames: tableHeaderInfoResponse.data.values[0],
    }

    // Note: we disallow blacklisted formulas and sanitise when necessary
    const createRowResponse = await session.request<{ index: number }>(
      `/tables/${tableId}/rows`,
      'post',
      {
        data: {
          index: null,
          values: [
            buildRowUpdateArgs(
              $,
              tableHeaderInfo.columnNames,
              columnValues.map((col) => ({
                columnName: col.columnName,
                value: sanitiseInputValue(col.value),
              })),
            ),
          ],
        },
      },
    )

    $.setActionItem({
      raw: {
        // `sheetRowNumber` exposes the actual row number of the created row.
        //
        // e.g. if I initially have an empty table with header row at row 10,
        // and I add a row of data, that created row's sheetRowNumber would be
        // 11.
        //
        // tableHeaderInfoResponse.data.rowIndex contains the 0-indexed row
        // number of the table's _header_ row. It follows that we can compute
        // the sheet row number via:
        //
        //   /* Compute the header's row number ... */
        //   tableHeaderInfoResponse.data.rowIndex + 1
        //   /* ...and add... */
        //   +
        //   /* ... the new row's index from the header row (1-indexed) */
        //   createRowResponse.data.index + 1
        sheetRowNumber:
          tableHeaderInfoResponse.data.rowIndex +
          1 +
          createRowResponse.data.index +
          1,
        success: true,
      },
    })
  },
}

export default action
