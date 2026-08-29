import { afterEach, vi } from 'vitest'

import * as redisConfig from '@/config/redis'

/**
 * Unit tests share a module graph (`isolate: false`). Queue modules call
 * createRedisClient at import time. Re-apply this mock after each test because
 * many suites call vi.restoreAllMocks() in afterEach.
 */
function mockRedisClient(): void {
  vi.spyOn(redisConfig, 'createRedisClient').mockReturnValue({} as never)
}

mockRedisClient()

afterEach(() => {
  mockRedisClient()
})
