import type { IApp } from '@plumber/types'

import beforeRequest from './common/interceptors/before-request'
import requestErrorObservers from './common/interceptors/request-error-observers'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'M365 Excel',
  key: 'm365-excel',
  iconUrl: '{BASE_URL}/apps/m365-excel/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/m365-excel',
  baseUrl: 'https://www.office.com',
  apiBaseUrl: 'https://graph.microsoft.com',
  primaryColor: '000000',
  auth,
  actions,
  beforeRequest,
  requestErrorObservers,
  dynamicData,
}

export default app
