import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

import { createClient } from '../auth/create-client'
import { getSchemaName } from '../common/get-schema-name'
import { DatabrickTableRes } from '../common/types'

const dynamicData: IDynamicData = {
  name: 'List Table Names',
  key: 'databricks-list-table-names',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      const client = await createClient($)
      const session = await client.openSession()
      const operation = await session.getTables({
        catalogName: databricksConfig.catalog,
        schemaName: getSchemaName($),
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
    }
  },
}

export default dynamicData
