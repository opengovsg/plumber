import { IDynamicAction, IGlobalVariable, IJSONObject } from '@plumber/types'

import validator from 'email-validator'
import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import logger from '@/helpers/logger'

import { createSession } from '../auth/create-client'
import { tableNameSchema } from '../common/schema'

const createTableSchema = z.object({
  tableName: tableNameSchema,
  userEmail: z.string().refine((val) => validator.validate(val), {
    message: 'Invalid email address',
  }),
})

const dynamicData: IDynamicAction = {
  name: 'Create Table',
  key: 'databricks-createTable',
  type: 'action',
  async run($: IGlobalVariable): Promise<IJSONObject> {
    const parametersParseResult = createTableSchema.safeParse({
      ...$.step.parameters,
      userEmail: $.user.email,
    })
    if (parametersParseResult.success === false) {
      throw new BadUserInputError(parametersParseResult.error.issues[0].message)
    }
    try {
      const { tableName } = parametersParseResult.data

      const { session, endSession } = await createSession($)
      // Note: DDL statements like CREATE TABLE don't support parameterization in Databricks.
      // Input validation via regex (only alphanumeric + underscore) provides SQL injection protection.

      const createTableOperation = await session.executeStatement(
        `CREATE TABLE \`${tableName}\`;`,
      )
      await createTableOperation.fetchAll()
      // We grant ALL PRIVILEGES to the current user to the table,
      // which includes reading, writing, altering table, and managing permis.
      const grantPermissionsOperation = await session.executeStatement(
        `GRANT ALL PRIVILEGES ON \`${tableName}\` TO \`${$.user.email}\`;`,
      )
      await grantPermissionsOperation.fetchAll()
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
