import type { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'M365 Excel',
  key: 'm365-excel',
  iconUrl: '{BASE_URL}/apps/m365-excel/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/m365-excel',
  baseUrl: 'https://www.office.com',
  apiBaseUrl: 'https://graph.microsoft.com',
  primaryColor: '000000',
  actions,
}

export default app
