import type { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Calculator',
  key: 'calculator',
  iconUrl: '{BASE_URL}/apps/calculator/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/calculator',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
  description: 'Perform calculations on numbers in your data',
  isNewApp: true,
}

export default app
