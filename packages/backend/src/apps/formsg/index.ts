import defineApp from '@/helpers/define-app'

import getDataOutMetadata from './metadata/get-data-out-metadata'
import auth from './auth'
import triggers from './triggers'

export default defineApp({
  name: 'FormSG',
  key: 'formsg',
  iconUrl: '{BASE_URL}/apps/formsg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/formsg',
  supportsConnections: true,
  baseUrl: 'https://form.gov.sg',
  apiBaseUrl: 'https://form.gov.sg/api',
  primaryColor: '635bff',
  beforeRequest: [],
  auth,
  triggers,
  actions: [],
  getDataOutMetadata,
})
