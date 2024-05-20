import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import logger from '@/helpers/logger'
import User from '@/models/user'

const dynamicData: IDynamicData = {
  name: 'List Tables',
  key: 'listTables',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    if (!$.user?.id) {
      throw new Error('No user found')
    }
    try {
      const currentUser = await User.query().findById($.user.id)
      const tiles = await currentUser
        .$relatedQuery('tables')
        .where('role', 'owner')
        .orderBy('created_at', 'desc')

      return {
        data: tiles.map((tile) => ({
          value: tile.id,
          name: tile.name,
        })),
      }
    } catch (e) {
      logger.error(e)
      throw new Error('Unable to fetch list of tiles')
    }
  },
}

export default dynamicData
