import { IGlobalVariable } from '@plumber/types'

import { getColumns } from '../helpers/get-columns'

export default {
  name: 'List updatable columns',
  key: 'listUpdatableColumns',

  async run($: IGlobalVariable) {
    return await getColumns($, true)
  },
}
