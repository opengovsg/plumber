import defineApp from '@/helpers/define-app'

import triggers from './triggers'

export default defineApp({
  name: 'Webhook',
  key: 'webhook',
  iconUrl: '{BASE_URL}/apps/webhook/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/webhooks',
  supportsConnections: false,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  triggers,
})
