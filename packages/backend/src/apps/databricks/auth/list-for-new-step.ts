import type User from '@/models/user'
import {
  connectionLabel,
  type McpConnection,
} from '@/services/mcp/list-connections'

import { parseDatabricksGeneration } from '../common/connection-generation'
import {
  ensureDatabricksConnection,
  isDatabricksNewEnabled,
} from './ensure-new-connection'
import getSystemAddedConnections from './get-system-added-connections'

export async function listDatabricksConnectionsForNewStep(
  user: User,
): Promise<McpConnection[]> {
  const gateOn = await isDatabricksNewEnabled(user.email)
  if (gateOn) {
    await ensureDatabricksConnection(user, true)
  }

  const connections = await getSystemAddedConnections(user)
  // The picker auto-assigns a single option, so a gated list must contain only the new row.
  const visible = gateOn
    ? connections.filter(
        (connection) =>
          parseDatabricksGeneration(connection.formattedData?.generation) ===
          'new',
      )
    : connections

  return visible.map((connection) => ({
    id: connection.id,
    appKey: connection.key,
    verified: connection.verified,
    label: connectionLabel(connection),
  }))
}
