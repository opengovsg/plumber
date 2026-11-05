import '@/instrumentation'
import '@/helpers/tracer'
import '@/config/orm'
import '@/config/dynamodb'
import '@/helpers/check-worker-readiness'
import { registerGracefulShutdown } from '@/helpers/graceful-shutdown'
import logger from '@/helpers/logger'
import { startSesConsumer, stopSesConsumer } from '@/helpers/ses-consumer'
import { closeActionWorkers } from '@/workers/action'
import { worker as flowWorker } from '@/workers/flow'
import { worker as triggerWorker } from '@/workers/trigger'

startSesConsumer()

registerGracefulShutdown(
  ['SIGTERM'],
  [
    () => flowWorker.close(),
    () => triggerWorker.close(),
    closeActionWorkers,
    stopSesConsumer,
  ],
)

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
    // oxlint-disable-next-line no-console
    console.log('Error happened to logger')
    console.error(e)
  }
})
