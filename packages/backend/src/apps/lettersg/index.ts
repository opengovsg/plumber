import type { IApp } from '@plumber/types'

import getTransferDetails from '@/helpers/get-basic-transfer-details'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'LetterSG',
  key: 'lettersg',
  iconUrl: '{BASE_URL}/apps/lettersg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/lettersg',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  dynamicData,
  getTransferDetails,
}

export default app
