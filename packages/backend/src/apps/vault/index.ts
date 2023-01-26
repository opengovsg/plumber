import defineApp from '../../helpers/define-app';
import addAuthHeader from './common/add-auth-header';
import auth from './auth';
import actions from './actions';
import triggers from './triggers';

const WORKSPACE_BASEURL = 'https://v3isb33ru0.execute-api.ap-southeast-1.amazonaws.com'

export default defineApp({
  name: 'Vault Workspace',
  key: 'vault-workspace',
  baseUrl: WORKSPACE_BASEURL,
  apiBaseUrl: WORKSPACE_BASEURL,
  iconUrl: '{BASE_URL}/apps/vault/assets/favicon.svg',
  authDocUrl: 'https://alpha.workspace.gov.sg',
  primaryColor: '000000',
  supportsConnections: true,
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  triggers
});
