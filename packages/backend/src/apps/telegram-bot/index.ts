import { IApp } from '@plumber/types'

import { getGenericAppQueue } from '@/queues/helpers/get-generic-app-queue'

import actions from './actions'
import auth from './auth'
import addAuthHeader from './common/add-auth-header'
import forceIpv4 from './common/force-ipv4'
import rateLimitHandler from './common/interceptor/rate-limit'
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
  beforeRequest: [forceIpv4, addAuthHeader],
  requestErrorHandler: rateLimitHandler,
  dynamicData,
  auth,
  actions,
  queue: getGenericAppQueue('TELEGRAM'),
  category: 'communication',
}

export default app
