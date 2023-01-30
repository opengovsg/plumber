import defineApp from '../../helpers/define-app';
import auth from './auth';
import actions from './actions';
import addAuthHeader from './common/add-auth-header';

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
  actions
});
