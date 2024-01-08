import type { IApp } from '@plumber/types'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'

/**
 * Caveat: Apps need to watch out (hur hur) if they are using WATCH / EXEC:
 * https://github.com/redis/ioredis/issues/266#issuecomment-332441562
 */
export const redisAppDataClient = createRedisClient(REDIS_DB_INDEX.APP_DATA)

export function makeRedisAppDataKey(app: IApp['key'], key: string): string {
  return `${app}:${key}`
}
