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
  // Mirrors the GetAppConnections GraphQL resolver (get-app.ts) which branches
  // on connectionType. Today only the pipe owner can invoke MCP tools, so we
  // return only connections the owner has access to.
  //
  // Collaborator support (future): the call site always has a flowId available.
  // When collaborators gain access, thread flowId through this function and:
  //   • system-added: also call getSharedConnections(flowId, isDraft=true) and
  //     return those shared connections, same as getApp does for editor-role users.
  //   • user-added: merge own connections with getSharedConnections(flowId,
  //     isDraft=false), same as getApp does for owner/viewer-role users.
  // See getSharedConnections in get-app.ts for the reference implementation.
  if (appKey) {
    const app = await App.findOneByKey(appKey)

    if (app?.auth?.connectionType === 'system-added') {
      // getSystemAddedConnections may insert new Connection rows for eligible
      // tenants as a side effect — this mirrors the GraphQL resolver's behaviour
      // and is intentional.
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
  // not enumerable without iterating every app's auth handler)
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
