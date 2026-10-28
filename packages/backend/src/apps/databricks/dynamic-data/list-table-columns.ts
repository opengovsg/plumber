import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import logger from '@/helpers/logger'

import { createSession } from '../auth/create-client'
import { resolveDatabricksWorkspace } from '../auth/resolve-workspace' // pragma: allowlist secret
import { constructSchemaName } from '../common/construct-schema-name'
import { DatabrickColumnRes } from '../common/types'

const dynamicData: IDynamicData = {
  name: 'List Table Columns',
  key: 'databricks-list-table-columns',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const tableName = $.step.parameters.tableName as string
    if (!tableName) {
      return {
        data: [],
        error: {
          message: 'Table name is required',
        },
      }
    }
    // oxfmt-ignore
    const credentials = resolveDatabricksWorkspace('legacy') // pragma: allowlist secret
    const { session, endSession } = await createSession($)
    try {
      const operation = await session.getColumns({
        tableName: $.step.parameters.tableName as string,
        catalogName: credentials.catalog,
        schemaName: constructSchemaName($),
      })
      const columns = (await operation.fetchAll({
        maxRows: 1000,
      })) as DatabrickColumnRes[]
      return {
        data: columns.map((column) => ({
          name: column.COLUMN_NAME,
          value: column.COLUMN_NAME,
        })),
      }
    } catch (e) {
      logger.error({
        event: 'databricks-list-table-columns',
        error: e,
      })
      return {
        data: [],
        error: {
          message: 'Failed to list table columns',
        },
      }
    } finally {
      await endSession()
    }
  },
}

export default dynamicData
