import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Toolbox',
  key: 'toolbox',
  iconUrl: '{BASE_URL}/apps/toolbox/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/toolbox',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
}

export default app
