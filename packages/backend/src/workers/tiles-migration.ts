import { WorkerPro } from '@taskforcesh/bullmq-pro'

import { createRedisClient } from '@/config/redis'
import logger from '@/helpers/logger'
import { runNightly } from '@/models/tiles/migration/run-nightly'
import tilesMigrationQueue, {
  TILES_MIGRATION_QUEUE_PREFIX,
} from '@/queues/tiles-migration'

export const worker = new WorkerPro('tiles-migration', () => runNightly(), {
  prefix: TILES_MIGRATION_QUEUE_PREFIX,
  connection: createRedisClient(),
  concurrency: 1,
})

worker.on('failed', (job, err) => {
  logger.error('tiles-migration.run.failed', {
    jobId: job?.id,
    err: err.stack,
  })
})

worker.on('error', (err) => {
  logger.error('tiles-migration worker errored', { err: err?.stack })
})

process.on('SIGTERM', async () => {
  await worker.close()
})

// A scheduler error must not stop the other workers in this process.
void (async () => {
  try {
    // Stops a manual promotion in bull-board from starting a second run.
    await tilesMigrationQueue.setGlobalConcurrency(1)
    await tilesMigrationQueue.upsertJobScheduler(
      'tiles-ddb-migration',
      { pattern: '0 0 1 * * *', tz: 'Asia/Singapore' },
      {
        name: 'run-nightly',
        opts: { attempts: 1, removeOnComplete: 30, removeOnFail: 30 },
      },
    )
  } catch (err) {
    logger.error('tiles-migration.scheduler.failed', {
      err: (err as Error).stack,
    })
  }
})()
