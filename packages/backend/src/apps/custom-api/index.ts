import defineApp from '@/helpers/define-app'

import addHeaders from './common/add-headers'
import actions from './actions'
import auth from './auth'

export default defineApp({
  name: 'Custom API',
  key: 'custom-api',
  iconUrl: '{BASE_URL}/apps/custom-api/assets/favicon.svg',
  authDocUrl: '',
  supportsConnections: true,
  beforeRequest: [addHeaders],
  auth,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
})
