import { IGlobalVariable, IRawAction } from '@plumber/types'

import { z } from 'zod'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'

import { createSession } from '../auth/create-client'

const databricksTableUrl = `https://${databricksConfig.serverHostname}/explore/tables/${databricksConfig.catalog}`

const insertRowSchema = z.object({
  tableName: z.string().min(1),
  rowData: z.array(
    z.object({
      columnName: z
        .string()
        .min(1, { message: 'Column name is required' })
        .regex(/^[a-z0-9_]+$/, {
          message:
            'Column name can only contain lowercase letters, numbers and underscores',
        }),
      columnValue: z.string(),
    }),
  ),
})

const createRowAction: IRawAction = {
  name: 'Create row',
  key: 'createDatabricksTableRow',
  description: 'Creates a new row in your databricks datable',
  arguments: [
    {
      label: 'Select Table',
      key: 'tableName',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      showOptionValue: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'databricks-list-table-names',
          },
        ],
      },
      addNewOption: {
        id: 'databricks-createTable',
        type: 'modal',
        label: 'Create a new table',
      },
      clickableLink: {
        label: 'View databricks dashboard',
        url: databricksTableUrl,
      },
    },
    {
      label: 'New row data',
      key: 'rowData',
      type: 'multirow-multicol' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'tableName',
        op: 'is_empty',
      },
      subFields: [
        {
          placeholder: 'Select or type to create a column',
          key: 'columnName',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          showOptionValue: false,
          addNewOption: {
            id: 'databricks-createTableColumn',
            type: 'inline',
            label: 'Create a new column',
          },
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'databricks-list-table-columns',
              },
              {
                name: 'parameters.tableName',
                value: '{parameters.tableName}',
              },
            ],
          },
          customStyle: { flex: 3 },
        },
        {
          placeholder: 'Value',
          key: 'columnValue',
          type: 'string' as const,
          required: false,
          variables: true,
          customStyle: { flex: 5, minWidth: 0, maxWidth: '62.5%' },
        },
      ],
    },
  ],

  async run($: IGlobalVariable) {
    try {
      const parametersParseResult = insertRowSchema.safeParse($.step.parameters)
      if (parametersParseResult.success === false) {
        throw new StepError(
          'Ensure your values are correct',
          parametersParseResult.error.issues[0].message,
          $.step.position,
          $.app.name,
        )
      }
      const { session, endSession } = await createSession($)
      const { tableName, rowData } = parametersParseResult.data
      const columnNames = rowData.map((row) => row.columnName)
      const columnValues = rowData.map((row) => row.columnValue)

      const statement = `INSERT INTO ${tableName} (${columnNames
        .map((col) => `\`${col}\``)
        .join(',')}) VALUES (${columnValues
        .map((_val, index) => `:val${index}`)
        .join(',')})`
      const namedParameters = {} as Record<string, string>
      for (let i = 0; i < columnValues.length; i++) {
        namedParameters[`val${i}`] = columnValues[i]
      }
      const operation = await session.executeStatement(statement, {
        namedParameters,
      })
      await operation.fetchAll()
      await endSession()
      $.setActionItem({
        raw: {
          success: true,
        },
      })
    } catch (e) {
      logger.error({
        event: 'databricks-create-row',
        stepId: $.step?.id,
        flowId: $.flow?.id,
        executionId: $.execution?.id,
        testRun: $.execution?.testRun,
        error: e,
      })
      throw new StepError(
        'Failed to create row',
        e.message,
        $.step.position,
        $.app.name,
      )
    }
  },
}

export default createRowAction
