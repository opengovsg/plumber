import { IApp } from '@plumber/types'

import triggers from './triggers'

const app: IApp = {
  name: 'Webhook',
  key: 'webhook',
  iconUrl: '{BASE_URL}/apps/webhook/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/webhooks',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  triggers,
}

export default app
