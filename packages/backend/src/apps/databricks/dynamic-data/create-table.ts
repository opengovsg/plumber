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
})

const dynamicData: IDynamicAction = {
  name: 'Create Table',
  key: 'databricks-createTable',
  type: 'action',
  async run($: IGlobalVariable): Promise<IJSONObject> {
    const parametersParseResult = createTableSchema.safeParse($.step.parameters)
    if (parametersParseResult.success === false) {
      throw new BadUserInputError(parametersParseResult.error.issues[0].message)
    }
    try {
      const { tableName } = parametersParseResult.data

      const { session, endSession } = await createSession($)
      // TODO: properly prepare this statement
      const statement = `CREATE TABLE \`${tableName}\`;`
      const operation = await session.executeStatement(statement)
      await operation.fetchAll()
      await endSession()
      return {
        newValue: tableName,
      }
    } catch (e) {
      logger.error({
        event: 'databricks-dynamic-data-create-table',
        error: e,
      })
      throw new Error('Failed to create table')
    }
  },
}

export default dynamicData
