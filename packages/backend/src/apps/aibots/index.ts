import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'AIBots',
  key: 'aibots',
  description: 'Integrate with your customised AI Bot',
  iconUrl: '{BASE_URL}/apps/aibots/assets/favicon.svg',
  authDocUrl: '',
  // TODO: update this to PROD once aibots releases the PROD API
  baseUrl: 'https://aibots.gov.sg',
  apiBaseUrl: 'https://api.aibots.gov.sg/v1.0/api',
  primaryColor: '',
  category: 'ai',
  // TODO: add the actual auth here
  // there is currently no verification available for aibots
  // its done directly in the action itself
  // (as requested by AiBots team)
  // auth,
  actions,
}

export default app
