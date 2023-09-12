import defineApp from '@/helpers/define-app'

import actions from './actions'

export const KEY = 'toolbelt'

export default defineApp({
  name: 'Toolbelt',
  key: KEY,
  iconUrl: '{BASE_URL}/apps/toolbelt/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/toolbelt',
  supportsConnections: false,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
})
