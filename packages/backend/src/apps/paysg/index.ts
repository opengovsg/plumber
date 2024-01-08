import type { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'

const app: IApp = {
  name: 'PaySG',
  key: 'paysg',
  iconUrl: '{BASE_URL}/apps/paysg/assets/favicon.svg',
  authDocUrl:
    'https://guide.pay.gov.sg/api/get-started-build-your-integration/get-started-with-paysgs-api',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  auth,
  actions,
}

export default app
