import type { IApp } from '@plumber/types'

import logger from '@/helpers/logger'

const http429Handler: IApp['requestErrorHandler'] = async function ($, error) {
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

  // We don't want to retry 429s from M365, so convert it into a non-HttpError.
  throw new Error('Rate limited by Microsoft Graph.')
}

export default http429Handler
