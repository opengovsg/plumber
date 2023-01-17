import defineApp from '../../helpers/define-app';
// import addAuthHeader from './common/add-auth-header';
import auth from './auth';
import actions from './actions';
import triggers from './triggers';

export default defineApp({
  name: 'Vault Workspace',
  key: 'vault-workspace',
  baseUrl: 'https://alpha.workspace.gov.sg',
  apiBaseUrl: 'https://alpha.workspace.gov.sg',
  iconUrl: '{BASE_URL}/apps/vault/assets/favicon.svg',
  authDocUrl: 'https://alpha.workspace.gov.sg',
  primaryColor: '000000',
  supportsConnections: true,
  auth,
  actions,
  triggers,
});
