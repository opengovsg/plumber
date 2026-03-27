import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Pair',
  key: 'pair',
  description: 'Summarise, categorise or analyse data with Pair',
  iconUrl: '{BASE_URL}/apps/pair/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '',
  actions,
  category: 'ai',
}
export default app
