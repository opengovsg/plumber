import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Email by Postman',
  key: 'postman',
  iconUrl: '{BASE_URL}/apps/postman/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/postman',
  baseUrl: 'https://postman.gov.sg',
  apiBaseUrl: 'https://api.postman.gov.sg',
  primaryColor: '000000',
  actions,
}

export default app
