import { vi } from 'vitest'

// Every unit test gets an in-memory Redis. A real client retries a refused
// connection forever, and that retry storm closes the vitest worker channel.
vi.mock('ioredis', async () => {
  const imported = await import('ioredis-mock')
  const RedisMock = imported.default

  return {
    default: RedisMock,
    Redis: RedisMock,
    Cluster: RedisMock.Cluster,
  }
})
