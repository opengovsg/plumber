import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

import { createSession } from '../auth/create-client'
import { constructSchemaName } from '../common/construct-schema-name'
import { DatabrickTableRes } from '../common/types'

const dynamicData: IDynamicData = {
  name: 'List Table Names',
  key: 'databricks-list-table-names',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      const { session, endSession } = await createSession($)
      const operation = await session.getTables({
        catalogName: databricksConfig.catalog,
        schemaName: constructSchemaName($),
        tableTypes: ['TABLE'],
      })
      const tables = (await operation.fetchAll({
        maxRows: 1000,
      })) as DatabrickTableRes[]
      await endSession()
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
    }
  },
}

export default dynamicData
