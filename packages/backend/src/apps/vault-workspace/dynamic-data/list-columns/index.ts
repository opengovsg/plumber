import { IGlobalVariable } from '@plumber/types'

import defineDynamicData from '@/helpers/define-dynamic-data'

import { getColumns } from '../helpers/get-columns'

export default defineDynamicData({
  name: 'List columns',
  key: 'listColumns',

  async run($: IGlobalVariable) {
    return await getColumns($)
  },
})
