import { IApp } from '@plumber/types'

import addHeaders from './common/add-headers'
import actions from './actions'
import auth from './auth'

const app: IApp = {
  name: 'Custom API',
  key: 'custom-api',
  iconUrl: '{BASE_URL}/apps/custom-api/assets/favicon.svg',
  authDocUrl: '',
  beforeRequest: [addHeaders],
  auth,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
}

export default app
