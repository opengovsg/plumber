import { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'

const app: IApp = {
  name: 'AISAY',
  key: 'aisay',
  description:
    'Extract data from documents such as invoices, bank statements, cheques, and more',
  iconUrl: '{BASE_URL}/apps/aisay/assets/favicon.svg',
  authDocUrl: '',
  auth,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
  substepLabels: {
    connectionStepLabel: 'Connect your AISAY account',
    settingsStepLabel: 'Set up step',
    addConnectionLabel: 'Add new AISAY connection',
  },
}

export default app
