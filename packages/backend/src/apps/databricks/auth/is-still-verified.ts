import type { IGlobalVariable } from '@plumber/types'

import logger from '@/helpers/logger'

import verifyCredentials from './verify-credentials'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  try {
    await verifyCredentials($)
    return true
  } catch (e) {
    logger.error('HEREHERHE', {
      event: 'databricks-is-still-verified',
      error: e,
    })
    return false
  }
}
