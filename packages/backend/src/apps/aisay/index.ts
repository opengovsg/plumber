import { IApp } from '@plumber/types'

import requestErrorHandler from './common/interceptors/request-error-handler'
import { aisayUrlConfig } from './common/url-config'
import actions from './actions'
import auth from './auth'
import queue from './queue'

const app: IApp = {
  name: 'AISAY',
  key: 'aisay',
  description:
    'Extract data from documents such as invoices, bank statements, cheques, and more',
  iconUrl: '{BASE_URL}/apps/aisay/assets/favicon.svg',
  authDocUrl: '',
  auth,
  baseUrl: aisayUrlConfig.baseUrl,
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
  requestErrorHandler,
  substepLabels: {
    connectionStepLabel: 'Connect your AISAY account',
    addConnectionLabel: 'Add new AISAY connection',
  },
  queue,
}

export default app
