import '@/helpers/tracer'
import '@/config/orm'
import '@/config/dynamodb'
import '@/helpers/check-worker-readiness'
import '@/workers/flow'
import '@/workers/trigger'
import '@/workers/action'

import logger from '@/helpers/logger'
import { startSesConsumer } from '@/helpers/ses-consumer'
import { reconcileInactiveFlowRepeatableJobs } from '@/queues/helpers/flow-repeatable-jobs'

startSesConsumer()

void reconcileInactiveFlowRepeatableJobs().catch((err) => {
  logger.error('Failed to reconcile leftover flow repeatable jobs', {
    err: err instanceof Error ? err.stack : err,
  })
})

process.on('uncaughtException', (err) => {
  try {
    if (!err) {
      logger.error('Worker uncaught undefined error')
      return
    }
    // catch-all just in case any errors bubble up and potentially crash the worker task
    logger.error(`Worker uncaught error with ${err.message}`, {
      err: err.stack,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Error happened to logger')
    console.error(e)
  }
})
