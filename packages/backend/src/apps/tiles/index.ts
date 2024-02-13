import { IApp } from '@plumber/types'

import actions from './actions'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'Tiles',
  description:
    'Tiles is a simple database to view, store and automate your data - all in one place',
  key: 'tiles',
  iconUrl: '{BASE_URL}/apps/tiles/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '',
  actions,
  dynamicData,
}

export default app
