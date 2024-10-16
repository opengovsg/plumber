import type { IApp } from '@plumber/types'

import getTransferDetails from './common/get-transfer-details'
import beforeRequest from './common/interceptors/before-request'
import requestErrorHandler from './common/interceptors/request-error-handler'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'
import queue from './queue'

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
  requestErrorHandler,
  dynamicData,
  getTransferDetails,
  queue,
  isNewApp: true,
  substepLabels: {
    connectionStepLabel: 'Connect to M365 Excel',
  },
  setupMessage: {
    variant: 'warning',
    messageBody:
      'There is a cap on total disk space and Excel actions across all Plumber users. To prevent disruption to your workflow, contact us if you have large files or need more than 100 Excel actions per hour.\n\nRead [our guide](https://guide.plumber.gov.sg/user-guides/actions/m365-excel) for more information.',
  },
}

export default app
