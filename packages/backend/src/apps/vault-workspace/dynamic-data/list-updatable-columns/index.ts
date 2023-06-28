import { IGlobalVariable } from '@plumber/types'

import defineDynamicData from '@/helpers/define-dynamic-data'

import { getColumns } from '../helpers/get-columns'

export default defineDynamicData({
  name: 'List updatable columns',
  key: 'listUpdatableColumns',

  async run($: IGlobalVariable) {
    return await getColumns($, true)
  },
})
