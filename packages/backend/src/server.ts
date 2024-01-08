import '@/helpers/tracer'
import '@/config/app-env-vars'

import type { Server } from 'http'

import app from '@/app'
import appConfig from '@/config/app'
import logger from '@/helpers/logger'

const port = appConfig.port

const server: Server = app.listen(port, () => {
  logger.info(`Server is listening on ${port}`)
})

function shutdown(server: Server) {
  server.close()
}

process.on('SIGTERM', () => {
  shutdown(server)
})
