import { NotFoundError } from 'objection'
import { vi } from 'vitest'

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
  currentUser.$relatedQuery = vi.fn().mockImplementation((relation: string) => {
    if (relation !== 'connections') {
      return {
        findOne: vi.fn().mockReturnValue({
          throwIfNotFound: vi.fn().mockResolvedValue(null),
        }),
      }
    }

    return {
      findOne: vi.fn().mockReturnValue({
        throwIfNotFound: connectionNotFound
          ? vi
              .fn()
              .mockRejectedValue(
                new NotFoundError({ message: 'Connection not found' }),
              )
          : vi.fn().mockResolvedValue({ id: connectionId, key: connectionKey }),
      }),
    }
  })
}
