import { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import queue from './queue'

const app: IApp = {
  name: 'AIBots',
  key: 'aibots',
  description: 'Integrate with your customised AI Bot',
  iconUrl: '{BASE_URL}/apps/aibots/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: 'https://aibots.gov.sg',
  apiBaseUrl: 'https://api.aibots.gov.sg/v1.0/api',
  primaryColor: '',
  category: 'ai',
  auth,
  actions,
  queue,
  beforeRequest: [addAuthHeader],
}

export default app
