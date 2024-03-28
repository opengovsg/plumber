import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'JavaScript',
  key: 'javascript',
  iconUrl: '{BASE_URL}/apps/javascript/assets/favicon.svg',
  authDocUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', // TODO: Gitbook guide
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
  description: `Run JavaScript in an isolated virtual machine`,
}

export default app
