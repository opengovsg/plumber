import { IDynamicAction, IGlobalVariable, IJSONObject } from '@plumber/types'
import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import logger from '@/helpers/logger'

import { createSession } from '../auth/create-client'
import { columnNameSchema, tableNameSchema } from '../common/schema'

const createTableSchema = z.object({
  tableName: tableNameSchema,
  columnName: columnNameSchema,
})

const dynamicData: IDynamicAction = {
  name: 'Create Column',
  key: 'databricks-createTableColumn',
  type: 'action',
  async run($: IGlobalVariable): Promise<IJSONObject> {
    const parametersParseResult = createTableSchema.safeParse($.step.parameters)
    if (parametersParseResult.success === false) {
      throw new BadUserInputError(parametersParseResult.error.issues[0].message)
    }

    try {
      const { tableName, columnName } = parametersParseResult.data

      const { session, endSession } = await createSession($)
      // Note: DDL statements like ALTER TABLE don't support parameterization in Databricks.
      // Input validation via regex (only alphanumeric + underscore) provides SQL injection protection.
      // We default to STRING type for the new column. Support for other types will be added later.
      const statement = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` STRING;`
      const operation = await session.executeStatement(statement)
      await operation.fetchAll()
      await endSession()
      return {
        newValue: columnName,
      }
    } catch (e) {
      logger.error({
        event: 'databricks-dynamic-data-create-table-column',
        error: e,
      })
      throw new Error('Failed to create column')
    }
  },
}

export default dynamicData
