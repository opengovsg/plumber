import { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'

const app: IApp = {
  name: 'AISAY',
  key: 'aisay',
  description:
    'AI-powered document reader that automates the extraction and validation of data',
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
