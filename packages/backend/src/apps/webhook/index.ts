import defineApp from '@/helpers/define-app'

import addHeaders from './common/add-headers'
import actions from './actions'
import auth from './auth'
import triggers from './triggers'

export default defineApp({
  name: 'Webhook',
  key: 'webhook',
  iconUrl: '{BASE_URL}/apps/webhook/assets/favicon.svg',
  authDocUrl: 'https://automatisch.io/docs/apps/webhook/connection',
  supportsConnections: true,
  beforeRequest: [addHeaders],
  auth,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  triggers,
  actions,
})
