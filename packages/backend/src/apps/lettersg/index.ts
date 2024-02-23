import type { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'

const app: IApp = {
  name: 'LetterSG',
  key: 'lettersg',
  iconUrl: '{BASE_URL}/apps/lettersg/assets/favicon.svg',
  authDocUrl: 'https://guide.letters.gov.sg/', // TODO (mal): change this to our own guide
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  auth,
  actions,
}

export default app
