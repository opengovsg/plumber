import { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

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
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  // disabling triggers from vault workspace
  dynamicData,
}

export default app
