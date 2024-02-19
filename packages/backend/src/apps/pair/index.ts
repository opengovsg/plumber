import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Pair',
  key: 'pair',
  baseUrl: 'https://pair.gov.sg',
  apiBaseUrl: 'https://staging.pair.gov.sg/api/v1',
  iconUrl: '{BASE_URL}/apps/pair/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/pair',
  primaryColor: '3C4764',
  actions,
}

export default app
