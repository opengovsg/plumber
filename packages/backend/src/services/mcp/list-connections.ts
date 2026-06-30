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
  const query = user
    .withAccessibleConnections({ requiredRole: 'viewer' })
    .where('connections.draft', false)

  if (appKey) {
    query.where('connections.key', appKey)
  }

  const connections = await query

  const seen = new Set<string>()
  const result: McpConnection[] = []
  for (const c of connections) {
    if (seen.has(c.id)) {
      continue
    }
    seen.add(c.id)
    result.push({
      id: c.id,
      appKey: c.key,
      verified: c.verified,
      label: c.description ?? c.key,
      formattedData: c.formattedData,
    })
  }
  return result
}
