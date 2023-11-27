import { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'Slack',
  key: 'slack',
  iconUrl: '{BASE_URL}/apps/slack/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/slack',
  baseUrl: 'https://slack.com',
  apiBaseUrl: 'https://slack.com/api',
  primaryColor: '4a154b',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  dynamicData,
}

export default app
