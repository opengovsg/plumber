import { ISystemAddedConnectionAuth } from '@plumber/types'

import getConnectionEnvironment from './get-connection-environment'
import getSystemAddedConnections from './get-system-added-connections'
import isStillVerified from './is-still-verified'
import refreshToken from './refresh-token'
import registerConnection from './register-connection'
import verifyConnectionRegistration from './verify-connection-registration'

const auth: ISystemAddedConnectionAuth = {
  refreshToken,

  connectionType: 'system-added',
  getSystemAddedConnections,
  getConnectionEnvironment,

  connectionRegistrationType: 'global',
  isStillVerified,
  registerConnection,
  verifyConnectionRegistration,
  connectionModalLabel: {
    chooseConnectionLabel: 'Connect to M365 Excel',
  },
}

export default auth
