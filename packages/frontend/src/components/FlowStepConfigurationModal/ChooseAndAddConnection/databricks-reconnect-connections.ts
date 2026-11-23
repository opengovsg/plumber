export type DatabricksGeneration = 'legacy' | 'new'

type ListedConnection = {
  id?: string | null
  generation?: string | null
}

type StoredConnection<T> = T & { id: string }

// The schema types id as nullable, but every stored connection has one.
function hasId<T extends ListedConnection>(
  connection: T,
): connection is StoredConnection<T> {
  return typeof connection.id === 'string' && connection.id !== ''
}

export function databricksGeneration(
  connection: ListedConnection,
): DatabricksGeneration {
  return connection.generation === 'new' ? 'new' : 'legacy'
}

export function pickDatabricksConnection<T extends ListedConnection>(
  connections: readonly T[],
): StoredConnection<T> | undefined {
  const stored = connections.filter(hasId)
  return (
    stored.find((connection) => databricksGeneration(connection) === 'new') ??
    stored[0]
  )
}

// A transferred pipe stores the old owner's connection id, which is absent here.
export function databricksReconnectConnections<T extends ListedConnection>(
  connections: readonly T[],
  storedConnectionId: string,
): T[] {
  const stored =
    connections.find((connection) => connection.id === storedConnectionId) ??
    pickDatabricksConnection(connections)
  return stored ? [stored] : []
}
