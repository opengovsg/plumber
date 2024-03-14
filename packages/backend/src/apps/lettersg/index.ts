import type { IApp } from '@plumber/types'

import addAuthHeader from './common/add-auth-header'
import actions from './actions'
import auth from './auth'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'LetterSG',
  key: 'lettersg',
  iconUrl: '{BASE_URL}/apps/lettersg/assets/favicon.svg',
  authDocUrl: 'https://guide.letters.gov.sg/', // TODO (mal): change this to our own guide
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  beforeRequest: [addAuthHeader],
  auth,
  actions,
  dynamicData,
}

export default app
