import tracer from 'dd-trace'

import appEnvConfig from '@/config/app/app-env'

import logger from './logger'

tracer.init({
  logInjection: true,
  service: 'plumber',
  logger,
  env: appEnvConfig.appEnv,
})

export default tracer
