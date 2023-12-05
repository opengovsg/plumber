import { ISystemAddedConnectionAuth } from '@plumber/types'

import getSystemAddedConnections from './get-system-added-connections'

const auth: ISystemAddedConnectionAuth = {
  connectionType: 'system-added',
  getSystemAddedConnections,
}

export default auth
