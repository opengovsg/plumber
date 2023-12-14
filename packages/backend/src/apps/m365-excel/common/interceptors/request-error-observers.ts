import type { IApp } from '@plumber/types'

import logger from '@/helpers/logger'

const http429Watcher: IApp['requestErrorObservers'][number] = async function (
  $,
  error,
) {
  if (error.response.status !== 429) {
    return
  }

  // A 429 response is considered a SEV-2+ incident for some tenants; log it
  // explicitly so that we can easily trigger incident creation from DD.
  logger.error('Received HTTP 429 from MS Graph', {
    event: 'm365-http-429',
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
  })
}

export default [http429Watcher]
