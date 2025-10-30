import { IDynamicAction, IGlobalVariable, IJSONObject } from '@plumber/types'

import { z } from 'zod'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import { BadUserInputError } from '@/errors/graphql-errors'
import logger from '@/helpers/logger'

import { createClient } from '../auth/create-client'
import { getSchemaName } from '../common/get-schema-name'

const createTableSchema = z.object({
  // table name must be lowercase and can only contain underscores
  tableName: z
    .string()
    .min(1, { message: 'Table name is required' })
    .regex(/^[a-z0-9_]+$/, {
      message:
        'Table name can only contain lowercase letters, numbers and underscores',
    }),
  columnName: z
    .string()
    .min(1, { message: 'Column name is required' })
    .regex(/^[a-z0-9_]+$/, {
      message:
        'Column name can only contain lowercase letters, numbers and underscores',
    }),
})

const dynamicData: IDynamicAction = {
  name: 'Create Column',
  key: 'databricks-createTableColumn',
  type: 'action',
  async run($: IGlobalVariable): Promise<IJSONObject> {
    try {
      const parametersParseResult = createTableSchema.safeParse(
        $.step.parameters,
      )
      if (parametersParseResult.success === false) {
        throw new BadUserInputError(
          parametersParseResult.error.issues[0].message,
        )
      }

      const { tableName, columnName } = parametersParseResult.data

      const client = await createClient($)
      const session = await client.openSession({
        initialSchema: getSchemaName($),
        initialCatalog: databricksConfig.catalog,
      })
      // TODO: properly prepare this statement
      const statement = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` STRING;`
      const operation = await session.executeStatement(statement)
      await operation.fetchAll()
      await session.close()
      await client.close()
      return {
        newValue: columnName,
      }
    } catch (e) {
      logger.error({
        event: 'databricks-dynamic-data-create-table-column',
        error: e,
      })
      throw new Error('Failed to create table')
    }
  },
}

export default dynamicData
