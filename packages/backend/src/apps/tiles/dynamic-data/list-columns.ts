import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import logger from '@/helpers/logger'
import User from '@/models/user'

const dynamicData: IDynamicData = {
  name: 'List Columns',
  key: 'listColumns',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    if (!$.user?.id) {
      throw new Error('No user found')
    }

    if (!$.step.parameters.tableId) {
      return { data: [] }
    }

    try {
      const currentUser = await User.query().findById($.user.id)
      const tile = await currentUser
        .$relatedQuery('tables')
        .findById($.step.parameters.tableId as string)
        .where('role', 'owner')
        .throwIfNotFound()
      const columns = await tile
        .$relatedQuery('columns')
        .orderBy('position', 'asc')

      return {
        data: columns.map(({ id, name }) => ({
          value: id,
          // + 1 since zero-indexed
          name: name,
        })),
      }
    } catch (e) {
      logger.error('Tiles dynamic data: list columns error', {
        userId: $.user?.id,
        tableId: $.step.parameters.tableId,
        flowId: $.flow?.id,
        stepId: $.step?.id,
      })
      throw new Error('Unable to fetch columns')
    }
  },
}

export default dynamicData
