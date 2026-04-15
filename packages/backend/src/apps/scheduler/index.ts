import { IApp } from '@plumber/types'

import triggers from './triggers'

const app: IApp = {
  name: 'Scheduler',
  key: 'scheduler',
  description: 'Schedule a time for this workflow to begin',
  iconUrl: '{BASE_URL}/apps/scheduler/assets/favicon.svg',
  docUrl: '',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  triggers,
}

export default app
