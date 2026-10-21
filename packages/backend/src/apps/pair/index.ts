import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Pair',
  key: 'pair',
  description: 'Process data using AI',
  iconUrl: '{BASE_URL}/apps/pair/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '',
  actions,
  category: 'ai',
  isNewApp: true,
}
export default app
