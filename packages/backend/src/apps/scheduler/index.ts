import { IApp } from '@plumber/types'

import triggers from './triggers'

const app: IApp = {
  name: 'Scheduler',
  key: 'scheduler',
  iconUrl: '{BASE_URL}/apps/scheduler/assets/favicon.svg',
  docUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/scheduler',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/scheduler',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  triggers,
}

export default app
