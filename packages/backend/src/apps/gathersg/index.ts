import type { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'GatherSG',
  key: 'gathersg',
  description: 'Case management system',
  iconUrl: '{BASE_URL}/apps/gathersg/assets/favicon.svg',
  authDocUrl: 'https://gather.gov.sg/', // TODO: update this to our own guide when it is ready
  baseUrl: '',
  apiBaseUrl: 'https://gather.gov.sg/cms/api',
  primaryColor: '000000',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  dynamicData,
  category: 'data',
}

export default app
