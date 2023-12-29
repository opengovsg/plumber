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
        .findOne({
          'table_metadata.id': $.step.parameters.tableId,
        })
        .throwIfNotFound()
      const columns = await tile
        .$relatedQuery('columns')
        .orderBy('position', 'asc')

      return {
        data: columns.map(({ id, name, position }) => ({
          value: id,
          // + 1 since zero-indexed
          name: `${position + 1}. ${name}`,
        })),
      }
    } catch (e) {
      logger.error(e)
      throw new Error('Unable to fetch columns')
    }
  },
}

export default dynamicData
