import { IDynamicData, IGlobalVariable } from '@plumber/types'

import { getColumns } from '../helpers/get-columns'

const dynamicData: IDynamicData = {
  name: 'List updatable columns',
  key: 'listUpdatableColumns',

  async run($: IGlobalVariable) {
    return await getColumns($, true)
  },
}

export default dynamicData
