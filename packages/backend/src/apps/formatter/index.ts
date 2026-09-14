import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Formatter',
  key: 'formatter',
  description: 'Format, compare, and calculate dates and times',
  iconUrl: '{BASE_URL}/apps/formatter/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/formatter',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
  category: 'data',
}

export default app
