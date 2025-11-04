import { IDynamicAction, IGlobalVariable, IJSONObject } from '@plumber/types'

import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import logger from '@/helpers/logger'

import { createSession } from '../auth/create-client'

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

      const { session, endSession } = await createSession($)
      // TODO: properly prepare this statement
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
      throw new Error('Failed to create table')
    }
  },
}

export default dynamicData
