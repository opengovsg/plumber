import type User from '@/models/user'

export interface McpConnection {
  id: string
  appKey: string
  verified: boolean
  label: string
}

export async function listConnectionsService(
  user: User,
): Promise<McpConnection[]> {
  const connections = await user
    .withAccessibleConnections({ requiredRole: 'viewer' })
    .where('connections.draft', false)

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
    })
  }
  return result
}
