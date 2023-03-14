import defineApp from '../../helpers/define-app'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'

export default defineApp({
  name: 'Postman',
  key: 'postman',
  iconUrl: '{BASE_URL}/apps/postman/assets/favicon.svg',
  authDocUrl:
    'https://github.com/opengovsg/postmangovsg/blob/master/docs/api-usage.md',
  supportsConnections: true,
  baseUrl: 'https://postman.gov.sg',
  apiBaseUrl: 'https://api.postman.gov.sg',
  primaryColor: '000000',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
})
