import { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'
import addHeaders from './common/add-headers'
import checkUrls from './common/check-urls'

const app: IApp = {
  name: 'Custom API',
  key: 'custom-api',
  description: 'Make a HTTP request',
  iconUrl: '{BASE_URL}/apps/custom-api/assets/favicon.svg',
  authDocUrl: '',
  beforeRequest: [checkUrls, addHeaders],
  auth,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
  category: 'others',
}

export default app
