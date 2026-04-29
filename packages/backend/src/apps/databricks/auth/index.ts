import { ISystemAddedConnectionAuth } from '@plumber/types'

import getSystemAddedConnections from './get-system-added-connections'
import isStillVerified from './is-still-verified'

const auth: ISystemAddedConnectionAuth = {
  connectionType: 'system-added',
  getSystemAddedConnections,
  isStillVerified,
  connectionModalLabel: {
    chooseConnectionLabel: 'Connect to Databricks',
  },
}

export default auth
