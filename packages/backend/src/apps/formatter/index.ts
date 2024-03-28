import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Formatter',
  key: 'formatter',
  iconUrl: '{BASE_URL}/apps/formatter/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/formatter',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
  description: 'Format your data',
}

export default app
