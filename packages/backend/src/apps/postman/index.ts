import defineApp from '@/helpers/define-app'

import actions from './actions'

export default defineApp({
  name: 'Email by Postman',
  key: 'postman',
  iconUrl: '{BASE_URL}/apps/postman/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/postman',
  supportsConnections: false,
  baseUrl: 'https://postman.gov.sg',
  apiBaseUrl: 'https://api.postman.gov.sg',
  primaryColor: '000000',
  actions,
})
