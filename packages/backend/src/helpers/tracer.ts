import tracer from 'dd-trace'

import logger from './logger'

tracer.init({
  logInjection: true,
  service: 'plumber',
  logger,
})

const span = tracer.startSpan('test', {})
span.finish()

tracer.scope().active()
export default tracer
