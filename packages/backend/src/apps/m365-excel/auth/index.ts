import { ISystemAddedConnectionAuth } from '@plumber/types'

import getSystemAddedConnections from './get-system-added-connections'
import refreshToken from './refresh-token'

const auth: ISystemAddedConnectionAuth = {
  refreshToken,

  connectionType: 'system-added',
  getSystemAddedConnections,
}

export default auth
