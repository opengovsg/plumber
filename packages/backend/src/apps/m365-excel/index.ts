import type { IApp } from '@plumber/types'

import getTransferDetails from './common/get-transfer-details'
import beforeRequest from './common/interceptors/before-request'
import requestErrorHandler from './common/interceptors/request-error-handler'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'
import queue from './queue'

const app: IApp = {
  name: 'M365 Excel (Pilot)',
  key: 'm365-excel',
  iconUrl: '{BASE_URL}/apps/m365-excel/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/m365-excel',
  baseUrl: 'https://www.office.com',
  apiBaseUrl: 'https://graph.microsoft.com',
  primaryColor: '000000',
  auth,
  actions,
  beforeRequest,
  requestErrorHandler,
  dynamicData,
  getTransferDetails,
  queue,
  substepLabels: {
    connectionStepLabel: 'Connect to M365 Excel',
  },
}

export default app
