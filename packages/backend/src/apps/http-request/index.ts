import defineApp from '@/helpers/define-app'

import addHeaders from './common/add-headers'
import actions from './actions'
import auth from './auth'

export default defineApp({
  name: 'HTTP Request',
  key: 'http-request',
  iconUrl: '{BASE_URL}/apps/http-request/assets/favicon.svg',
  authDocUrl: '',
  supportsConnections: true,
  beforeRequest: [addHeaders],
  auth,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
})
