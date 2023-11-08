import type { IGlobalVariable } from '@plumber/types'

import verifyCredentials from './verify-credentials'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  await verifyCredentials($)
  return true
}
