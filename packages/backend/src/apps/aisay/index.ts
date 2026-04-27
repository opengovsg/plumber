import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'AISAY',
  key: 'aisay',
  category: 'others',
  description:
    'Extract data from documents such as invoices, bank statements, cheques, and more',
  iconUrl: '{BASE_URL}/apps/aisay/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
}

export default app
