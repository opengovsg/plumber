import { IGlobalVariable } from '@plumber/types'

import verifyCredentials from './verify-credentials'

const isStillVerified = async ($: IGlobalVariable) => {
  await verifyCredentials($)
  return true
}

export default isStillVerified
