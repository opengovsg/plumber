import { IApp } from '@plumber/types'

import triggers from './triggers'

const app: IApp = {
  name: 'Manual trigger',
  key: 'manual',
  description: 'Trigger this workflow manually, on demand',
  iconUrl: '{BASE_URL}/apps/manual/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  triggers,
}

export default app
