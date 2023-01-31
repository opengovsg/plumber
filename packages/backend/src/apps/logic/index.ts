import defineApp from '../../helpers/define-app';
import actions from './actions'

export default defineApp({
  name: 'Logic',
  key: 'logic',
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/107/107799.png',
  authDocUrl: '',
  supportsConnections: false,
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
})
