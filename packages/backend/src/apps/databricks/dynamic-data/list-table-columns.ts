import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

import { createClient } from '../auth/create-client'
import { getSchemaName } from '../common/get-schema-name'
import { DatabrickColumnRes } from '../common/types'

const dynamicData: IDynamicData = {
  name: 'List Table Columns',
  key: 'databricks-list-table-columns',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      const tableName = $.step.parameters.tableName as string
      if (!tableName) {
        return {
          data: [],
          error: {
            message: 'Table name is required',
          },
        }
      }
      const client = await createClient($)
      const session = await client.openSession({
        initialSchema: getSchemaName($),
        initialCatalog: databricksConfig.catalog,
      })
      const operation = await session.getColumns({
        tableName: $.step.parameters.tableName as string,
      })
      const columns = (await operation.fetchAll({
        maxRows: 1000,
      })) as DatabrickColumnRes[]
      await session.close()
      await client.close()
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
    }
  },
}

export default dynamicData
