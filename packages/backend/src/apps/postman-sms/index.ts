import { IApp } from '@plumber/types'

import beforeRequest from './common/before-request'
import requestErrorHandler from './common/request-error-handler'
import actions from './actions'
import queue from './queue'

const app: IApp = {
  name: 'SMS by Postman',
  key: 'postman-sms',
  iconUrl: '{BASE_URL}/apps/postman-sms/assets/favicon.svg',
  beforeRequest,
  requestErrorHandler,
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/postman-sms',
  baseUrl: '',
  apiBaseUrl: '', // Populated in beforeRequest
  primaryColor: '000000',
  actions,
  queue,
  isNewApp: true,
  setupMessage: {
    variant: 'info',
    messageBody:
      'This service is free until **May 2025**. Find out more [here](https://guide.plumber.gov.sg/user-guides/actions/postman-sms).',
  },
}

export default app
