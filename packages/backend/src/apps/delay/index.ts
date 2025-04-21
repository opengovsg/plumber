import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Delay',
  key: 'delay',
  description:
    'Delay execution of the next step by a specified amount of time or until a specified date',
  iconUrl: '{BASE_URL}/apps/delay/assets/favicon.svg',
  authDocUrl: 'https://automatisch.io/docs/apps/delay/connection',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '001F52',
  actions,
  category: 'others',
}

export default app
