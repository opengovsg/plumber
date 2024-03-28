import type { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'

const app: IApp = {
  name: 'PaySG',
  key: 'paysg',
  iconUrl: '{BASE_URL}/apps/paysg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/paysg',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
}

export default app
