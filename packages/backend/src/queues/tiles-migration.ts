import { QueuePro } from '@taskforcesh/bullmq-pro'
import process from 'process'

import { createRedisClient } from '@/config/redis'

export const TILES_MIGRATION_QUEUE_PREFIX = '{tilesMigrationQ}'

const tilesMigrationQueue = new QueuePro('tiles-migration', {
  prefix: TILES_MIGRATION_QUEUE_PREFIX,
  connection: createRedisClient(),
})

process.on('SIGTERM', async () => {
  await tilesMigrationQueue.close()
})

export default tilesMigrationQueue
