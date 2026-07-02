import type { IJSONObject } from '@plumber/types'

import type User from '@/models/user'

export interface McpConnection {
  id: string
  appKey: string
  verified: boolean
  label: string
  formattedData?: IJSONObject
}

export async function listConnectionsService(
  user: User,
  appKey?: string,
): Promise<McpConnection[]> {
  // Use $relatedQuery to match GetAppConnections (get-app.ts) owner behaviour:
  // return only connections owned by this user, same as the pipe editor when no
  // flowId is supplied. Only the pipe owner can invoke MCP tools today, so we
  // don't need to fetch shared connections.
  //
  // Future enhancement — collaborator support: when collaborators are allowed to
  // use this tool, accept a flowId parameter and also merge in shared connections
  // via withAccessibleFlowConnections filtered by that flowId, mirroring the
  // getSharedConnections helper in get-app.ts.
  const query = user.$relatedQuery('connections').where('draft', false)

  if (appKey) {
    query.andWhere('key', appKey)
  }

  const connections = await query

  return connections.map((c) => ({
    id: c.id,
    appKey: c.key,
    verified: c.verified,
    label: c.description ?? c.key,
    formattedData: c.formattedData,
  }))
}
