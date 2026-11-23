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

// The API returns null for an invalid stored generation. Such a row must not be auto-bound.
export function databricksGeneration(
  connection: ListedConnection,
): DatabricksGeneration | null {
  return connection.generation === 'new' || connection.generation === 'legacy'
    ? connection.generation
    : null
}

export function pickDatabricksConnection<T extends ListedConnection>(
  connections: readonly T[],
): StoredConnection<T> | undefined {
  const stored = connections.filter(hasId)
  return (
    stored.find((connection) => databricksGeneration(connection) === 'new') ??
    stored.find((connection) => databricksGeneration(connection) === 'legacy')
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
