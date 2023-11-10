import { IDynamicData, IGlobalVariable } from '@plumber/types'

import { getColumns } from '../helpers/get-columns'

const dynamicData: IDynamicData = {
  name: 'List columns',
  key: 'listColumns',

  async run($: IGlobalVariable) {
    return await getColumns($)
  },
}

export default dynamicData
