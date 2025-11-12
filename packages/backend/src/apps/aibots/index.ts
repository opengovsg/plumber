import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'AIBots',
  key: 'aibots',
  description: 'Integrate with your customised AI Bot',
  iconUrl: '{BASE_URL}/apps/aibots/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '',
  category: 'ai',
  // TODO: add the actual auth here
  // auth,
  actions,
}

export default app
