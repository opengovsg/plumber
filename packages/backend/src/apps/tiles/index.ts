import { IApp } from '@plumber/types'

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
  dynamicData,
}

export default app
