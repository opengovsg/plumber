import { IApp } from '@plumber/types'

import beforeRequest from './common/before-request'
import requestErrorHandler from './common/request-error-handler'
import actions from './actions'
import auth from './auth'
import queue from './queue'

const app: IApp = {
  name: 'SMS by Postman',
  key: 'postman-sms',
  description: "Send SMSes using your agency's Postman v2 account",
  iconUrl: '{BASE_URL}/apps/postman-sms/assets/favicon.svg',
  beforeRequest,
  requestErrorHandler,
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/sms-by-postman',
  baseUrl: '',
  apiBaseUrl: '', // Populated in beforeRequest
  primaryColor: '000000',
  auth,
  actions,
  queue,
  isNewApp: true,
  priority: 10,
}

export default app
