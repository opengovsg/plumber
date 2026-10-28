import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import logger from '@/helpers/logger'

import { createSession } from '../auth/create-client'
import { resolveDatabricksWorkspace } from '../auth/resolve-workspace' // pragma: allowlist secret
import { constructSchemaName } from '../common/construct-schema-name'
import { DatabrickTableRes } from '../common/types'

const dynamicData: IDynamicData = {
  name: 'List Table Names',
  key: 'databricks-list-table-names',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    // oxfmt-ignore
    const credentials = resolveDatabricksWorkspace('legacy') // pragma: allowlist secret
    const { session, endSession } = await createSession($)
    try {
      const operation = await session.getTables({
        catalogName: credentials.catalog,
        schemaName: constructSchemaName($),
        tableTypes: ['TABLE'],
      })
      const tables = (await operation.fetchAll({
        maxRows: 1000,
      })) as DatabrickTableRes[]
      return {
        data: tables.map((row) => ({
          name: row.TABLE_NAME,
          value: row.TABLE_NAME,
        })),
      }
    } catch (e) {
      logger.error({
        event: 'databricks-list-table-names',
        error: e,
      })
      return {
        data: [],
        error: {
          message: 'Failed to list table names',
        },
      }
    } finally {
      await endSession()
    }
  },
}

export default dynamicData
