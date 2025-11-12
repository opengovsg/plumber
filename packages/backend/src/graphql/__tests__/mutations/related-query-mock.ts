import { NotFoundError } from 'objection'
import { vi } from 'vitest'

import Connection from '@/models/connection'
import User from '@/models/user'

interface MockConnectionsRelatedQueryOptions {
  connectionId: string
  connectionKey: string
  connectionNotFound?: boolean
}

export function mockConnectionsRelatedQuery(
  currentUser: User,
  {
    connectionId,
    connectionKey,
    connectionNotFound = false,
  }: MockConnectionsRelatedQueryOptions,
) {
  vi.spyOn(Connection, 'query').mockReturnValue({
    findById: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        throwIfNotFound: connectionNotFound
          ? vi
              .fn()
              .mockRejectedValue(
                new NotFoundError({ message: 'Connection not found' }),
              )
          : vi.fn().mockResolvedValue({ id: connectionId, key: connectionKey }),
      }),
    }),
  } as any)
}
