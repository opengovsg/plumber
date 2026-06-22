import '@/instrumentation'
import '@/helpers/tracer'
import '@/config/app-env-vars'

import type { Server } from 'http'

import app from '@/app'
import appConfig from '@/config/app'
import logger from '@/helpers/logger'
import { startQueueDepthMetrics } from '@/helpers/queue-depth-metrics'

const port = appConfig.port

const ALB_IDLE_TIMEOUT_SECONDS = 60

const server: Server = app.listen(port, () => {
  logger.info(`Server is listening on ${port}`)
})

// Worker uptime SLI: sample queue depth from the server process (decoupled
// from worker health) and emit gauges to Datadog.
startQueueDepthMetrics()

function shutdown(server: Server) {
  server.close()
}

process.on('SIGTERM', () => {
  shutdown(server)
})

// As per AWS guidelines, we should set the server timeout to be longer than ALB idle timeout
// https://repost.aws/knowledge-center/elb-alb-troubleshoot-502-errors
server.keepAliveTimeout = (ALB_IDLE_TIMEOUT_SECONDS + 1) * 1000
server.headersTimeout = (ALB_IDLE_TIMEOUT_SECONDS + 2) * 1000
