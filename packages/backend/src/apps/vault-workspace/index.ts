import { IApp } from '@plumber/types'

import actions from './actions'

const WORKSPACE_BASEURL =
  'https://jcxk888grj.execute-api.ap-southeast-1.amazonaws.com'

const app: IApp = {
  name: 'Vault Workspace',
  key: 'vault-workspace',
  baseUrl: WORKSPACE_BASEURL,
  apiBaseUrl: WORKSPACE_BASEURL,
  iconUrl: '{BASE_URL}/apps/vault-workspace/assets/favicon.svg',
  authDocUrl:
    'https://guide.plumber.gov.sg/user-guides/actions/vault-workspace',
  primaryColor: '000000',
  actions,
  // disabling triggers from vault workspace
}

export default app
