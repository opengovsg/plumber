import defineApp from '@/helpers/define-app'

import actions from './actions'

export default defineApp({
  name: 'Plumber Toolbelt',
  key: 'plumber-toolbelt',
  iconUrl: '{BASE_URL}/apps/plumber-toolbelt/assets/favicon.svg',
  authDocUrl:
    'https://guide.plumber.gov.sg/user-guides/actions/plumber-toolbelt',
  supportsConnections: false,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
})
