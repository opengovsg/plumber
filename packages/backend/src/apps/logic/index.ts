import defineApp from '../../helpers/define-app';
import actions from './actions'

export default defineApp({
  name: 'Logic',
  key: 'logic',
  iconUrl: '{BASE_URL}/apps/logic/assets/favicon.svg',
  authDocUrl: '',
  supportsConnections: false,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
})
