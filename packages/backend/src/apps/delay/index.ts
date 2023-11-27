import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Delay',
  key: 'delay',
  iconUrl: '{BASE_URL}/apps/delay/assets/favicon.svg',
  authDocUrl: 'https://automatisch.io/docs/apps/delay/connection',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '001F52',
  actions,
}

export default app
