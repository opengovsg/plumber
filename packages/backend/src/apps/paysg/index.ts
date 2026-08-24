import type { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'
import addAuthHeader from './common/add-auth-header'

const app: IApp = {
  name: 'PaySG',
  key: 'paysg',
  description:
    'Create payment, get details of payments created and send emails to payees',
  iconUrl: '{BASE_URL}/apps/paysg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/paysg',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  category: 'others',
}

export default app
