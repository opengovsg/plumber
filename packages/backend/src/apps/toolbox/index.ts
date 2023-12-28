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
  description: `Use Plumber's built in tools like If-then and Only continue if to add more functionality to your pipes`,
}

export default app
