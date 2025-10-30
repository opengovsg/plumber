import { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'Databricks',
  key: 'databricks',
  description: 'Store data for analytics and machine learning',
  iconUrl: '{BASE_URL}/apps/databricks/assets/favicon.svg',
  authDocUrl: '',
  beforeRequest: [],
  auth,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '0059F7',
  actions,
  dynamicData,
  category: 'data',
}

export default app
