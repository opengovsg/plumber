import defineApp from '@/helpers/define-app'

import actions from './actions'

export default defineApp({
  name: 'Toolbox',
  key: 'toolbox',
  iconUrl: '{BASE_URL}/apps/toolbox/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/toolbox',
  supportsConnections: false,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
  description: `Use Plumber's built in tools like if... then to add more functionality to your pipes`,
})
