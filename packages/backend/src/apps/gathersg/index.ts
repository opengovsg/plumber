import type { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'GatherSG',
  key: 'gathersg',
  description: 'Update a case', // Update description when there are more actions
  iconUrl: '{BASE_URL}/apps/gathersg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/lettersg', // TODO: update this
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
