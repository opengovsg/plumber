import type { IGlobalVariable } from '@plumber/types'

import verifyCredentials from './verify-credentials'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  try {
    await verifyCredentials($)
    return true
  } catch (e) {
    return false
  }
}
