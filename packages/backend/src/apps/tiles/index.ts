import { IApp } from '@plumber/types'

import actions from './actions'
import getTransferDetails from './common/get-transfer-details'
import dynamicData from './dynamic-data'
import queue from './queue'

const app: IApp = {
  name: 'Tiles',
  key: 'tiles',
  description:
    'A simple built-in database to view, store and automate your data',
  iconUrl: '{BASE_URL}/apps/tiles/assets/favicon.svg',
  authDocUrl: '',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '',
  actions,
  dynamicData,
  getTransferDetails,
  queue,
  category: 'data',
}

export default app
