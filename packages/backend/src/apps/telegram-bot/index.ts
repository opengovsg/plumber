import { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import rateLimitHandler from './common/interceptor/rate-limit'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'Telegram',
  key: 'telegram-bot',
  description: 'Send messages to a Telegram chat, group or channel',
  iconUrl: '{BASE_URL}/apps/telegram-bot/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/telegram',
  baseUrl: 'https://telegram.org',
  apiBaseUrl: 'https://api.telegram.org',
  primaryColor: '2AABEE',
  beforeRequest: [addAuthHeader],
  requestErrorHandler: rateLimitHandler,
  dynamicData,
  auth,
  actions,
  category: 'communications',
}

export default app
