import type { IJSONObject } from '@plumber/types'

import App from '@/models/app'
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
  // Mirror GetAppConnections (get-app.ts): branch on connectionType when an
  // appKey is known, just as the pipe editor does.
  //
  // Future enhancement — collaborator support: when collaborators are allowed to
  // use this tool, accept a flowId parameter and also merge in shared connections
  // via withAccessibleFlowConnections filtered by that flowId, mirroring the
  // getSharedConnections helper in get-app.ts.
  if (appKey) {
    const app = await App.findOneByKey(appKey)

    if (app?.auth?.connectionType === 'system-added') {
      const connections = await app.auth.getSystemAddedConnections(user)
      return connections.map((c) => ({
        id: c.id,
        appKey: c.key,
        verified: c.verified,
        label: c.description ?? c.key,
        formattedData: c.formattedData,
      }))
    }
  }

  // user-added connections (or no appKey — system-added across all apps is
  // not enumerable without knowing each app's auth handler)
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
