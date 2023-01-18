import defineApp from '../../helpers/define-app';
import auth from './auth'
import actions from './actions'

export default defineApp({
  name: 'Postman',
  key: 'postman',
  iconUrl: 'https://postman.gov.sg/favicon-32x32.png',
  authDocUrl: 'https://github.com/opengovsg/postmangovsg/blob/master/docs/api-usage.md',
  supportsConnections: true,
  baseUrl: 'https://postman.gov.sg',
  apiBaseUrl: 'https://api.postman.gov.sg',
  primaryColor: '000000',
  auth,
  actions,
})
