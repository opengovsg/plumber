import { IApp } from '@plumber/types'

import actions from './actions'
import dynamicData from './dynamic-data'

const app: IApp = {
  name: 'Tiles',
  description: `Plumber's simple database for storing and retrieving data`,
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
