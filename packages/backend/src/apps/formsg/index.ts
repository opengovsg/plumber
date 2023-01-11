import defineApp from '../../helpers/define-app';
import triggers from './triggers';
import auth from './auth';

export default defineApp({
  name: 'FormSG',
  key: 'formsg',
  iconUrl: '{BASE_URL}/apps/formsg/assets/favicon.svg',
  authDocUrl: 'https://guide.form.gov.sg/user-guides/advanced-guide/webhooks',
  supportsConnections: true,
  baseUrl: 'https://form.gov.sg',
  apiBaseUrl: 'https://form.gov.sg/api',
  primaryColor: '635bff',
  beforeRequest: [],
  auth,
  triggers,
  actions: []
});
