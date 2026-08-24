import { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'
import addAuthHeader from './common/add-auth-header'

const app: IApp = {
  name: 'Twilio',
  key: 'twilio',
  iconUrl: '{BASE_URL}/apps/twilio/assets/favicon.svg',
  authDocUrl: 'https://automatisch.io/docs/apps/twilio/connection',
  baseUrl: 'https://twilio.com',
  apiBaseUrl: 'https://api.twilio.com',
  primaryColor: 'e1000f',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
}

export default app
