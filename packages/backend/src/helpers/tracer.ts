import tracer from 'dd-trace'

import logger from './logger'

tracer.init({
  logInjection: true,
  service: 'plumber',
  logger,
})

export default tracer
