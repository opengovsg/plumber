import { IApp } from '@plumber/types'

import triggers from './triggers'

const app: IApp = {
  name: 'Webhook',
  key: 'webhook',
  description: 'Workflow begins when Plumber receives data',
  iconUrl: '{BASE_URL}/apps/webhook/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/webhooks',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  triggers,
}

export default app
