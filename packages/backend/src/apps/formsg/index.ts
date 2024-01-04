import { IApp } from '@plumber/types'

import auth from './auth'
import triggers from './triggers'

const app: IApp = {
  name: 'FormSG',
  key: 'formsg',
  iconUrl: '{BASE_URL}/apps/formsg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/formsg',
  baseUrl: 'https://form.gov.sg',
  apiBaseUrl: 'https://form.gov.sg/api',
  primaryColor: '635bff',
  beforeRequest: [],
  auth,
  triggers,
  actions: [],
}

export default app
