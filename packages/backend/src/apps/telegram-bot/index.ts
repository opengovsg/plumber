import defineApp from '@/helpers/define-app'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

export default defineApp({
  name: 'Telegram',
  key: 'telegram-bot',
  iconUrl: '{BASE_URL}/apps/telegram-bot/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/telegram',
  supportsConnections: true,
  baseUrl: 'https://telegram.org',
  apiBaseUrl: 'https://api.telegram.org',
  primaryColor: '2AABEE',
  beforeRequest: [addAuthHeader],
  dynamicData,
  auth,
  actions,
})
