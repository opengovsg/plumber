import type { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'
import queue from './queue'
import triggers from './triggers'

const app: IApp = {
  name: 'Ownself Gather',
  key: 'gathersg',
  description: 'Case management system',
  iconUrl: '{BASE_URL}/apps/gathersg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/ownself-gather',
  baseUrl: '',
  apiBaseUrl: 'https://gather.gov.sg/cms/api',
  primaryColor: '000000',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  triggers,
  dynamicData,
  queue,
  category: 'data',
}

export default app
