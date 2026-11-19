type ReconnectConnection = {
  id?: string | null
  generation?: string | null
}

// A transferred pipe stores the old owner's connection id, which is absent here.
export function databricksReconnectConnections<T extends ReconnectConnection>(
  connections: readonly T[],
  storedConnectionId: string,
): T[] {
  const stored = connections.filter(
    (connection) => connection.id === storedConnectionId,
  )
  if (stored.length > 0) {
    return stored
  }

  const created = connections.find(
    (connection) => connection.generation === 'new' && connection.id,
  )
  if (created) {
    return [created]
  }

  const legacy = connections.find(
    (connection) =>
      connection.id &&
      (connection.generation === 'legacy' || connection.generation == null),
  )
  return legacy ? [legacy] : []
}

// The dropdown shows both generations when this user owns the stored row.
// A transferred pipe stores an id that is absent, so that case still returns one row.
export function databricksReconnectDropdownConnections<
  T extends ReconnectConnection,
>(
  connections: readonly T[],
  storedConnectionId: string | undefined,
): readonly T[] {
  if (
    storedConnectionId &&
    !connections.some((connection) => connection.id === storedConnectionId)
  ) {
    return databricksReconnectConnections(connections, storedConnectionId)
  }
  return connections
}
